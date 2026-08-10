import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ErrorResponseSchema,
  GitHistoryLimitSchema,
  MemoryClient,
  MemoryClientError,
  NoteCreateSchema,
  SearchRequestSchema,
} from "./memory.js";

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const emptyResponse = (status = 204): Response => new Response(null, { status });

describe("MemoryClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("normalizes the base URL and performs health checks", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    await expect(new MemoryClient("http://memory.test///").health()).resolves.toEqual({
      status: "ok",
    });
    expect(fetchMock).toHaveBeenCalledWith("http://memory.test/health", { method: "GET" });
  });

  test("sends JSON for note mutations and applies NoteCreate defaults", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "note-1", path: "notes/a.md" }, 201));

    await new MemoryClient("http://memory.test/").createNote({
      path: "notes/a.md",
      content: "",
      frontmatter: {},
    });

    expect(fetchMock).toHaveBeenCalledWith("http://memory.test/v1/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "notes/a.md", content: "", frontmatter: {} }),
    });
    expect(NoteCreateSchema.parse({ path: "notes/a.md" })).toEqual({
      path: "notes/a.md",
      content: "",
      frontmatter: {},
    });
  });

  test("uses encoded note paths and validates GET, PUT, history, revision and restore", async () => {
    const client = new MemoryClient("http://memory.test");
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: "note/1",
          path: "folder/a.md",
          title: "A",
          content: "body",
          raw: "body",
          frontmatter: {},
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "note/1", path: "folder/b.md" }))
      .mockResolvedValueOnce(jsonResponse({ note_id: "note/1", history: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ note_id: "note/1", revision: "HEAD~1", path: "folder/a.md", raw: "old" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "note/1", path: "folder/a.md", revision: "HEAD~1" }),
      );

    await client.getNote("note/1");
    await client.updateNote("note/1", { path: "folder/b.md" });
    await client.getNoteHistory("note/1");
    await client.getRevision("note/1", "HEAD~1");
    await client.restoreNote("note/1", { revision: "HEAD~1" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://memory.test/v1/notes/note%2F1",
      "http://memory.test/v1/notes/note%2F1",
      "http://memory.test/v1/notes/note%2F1/history",
      "http://memory.test/v1/notes/note%2F1/revisions/HEAD~1",
      "http://memory.test/v1/notes/note%2F1/restore",
    ]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "folder/b.md" }),
    });
  });

  test("sends SearchRequest defaults and only Git history uses a query parameter", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ query: "notes", mode: "hybrid", results: [] }))
      .mockResolvedValueOnce(jsonResponse({ history: [] }));
    const client = new MemoryClient("http://memory.test");

    await client.search({
      query: "notes",
      mode: "hybrid",
      tags: [],
      expand_links: false,
    });
    await client.getGitHistory();

    expect(SearchRequestSchema.parse({ query: "notes" })).toEqual({
      query: "notes",
      mode: "hybrid",
      tags: [],
      expand_links: false,
    });
    expect(GitHistoryLimitSchema.parse(undefined)).toBe(50);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://memory.test/v1/search");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://memory.test/v1/git/history?limit=50");
  });

  test("covers Git, reindex and the 204 delete response", async () => {
    const client = new MemoryClient("http://memory.test");
    const deleteJson = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ initialized: true, path: ".git" }))
      .mockResolvedValueOnce(jsonResponse({ initialized: true, entries: [] }))
      .mockResolvedValueOnce(jsonResponse({ diff: "" }))
      .mockResolvedValueOnce(jsonResponse({ created: true, commit: "abc" }))
      .mockResolvedValueOnce(
        jsonResponse({ reindexed: true, indexed: 1, deleted: 0, duplicates: [] }),
      )
      .mockResolvedValueOnce({ ok: true, status: 204, json: deleteJson } as unknown as Response);

    await client.initGit();
    await client.getGitStatus();
    await client.getGitDiff();
    await client.createCheckpoint({ message: "checkpoint" });
    await client.reindex();
    await client.deleteNote("note-1");

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ message: "checkpoint" }),
    });
    expect(deleteJson).not.toHaveBeenCalled();
  });

  test("throws MemoryClientError with a validated structured error", async () => {
    const payload = { error: { code: "not_found", message: "Note is missing" } };
    fetchMock.mockResolvedValue(jsonResponse(payload, 404));

    const error = await new MemoryClient("http://memory.test").getNote("missing").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(MemoryClientError);
    expect(error).toMatchObject({
      endpoint: "http://memory.test/v1/notes/missing",
      status: 404,
      payload,
      errorResponse: ErrorResponseSchema.parse(payload),
      message: "Note is missing",
    });
  });

  test("throws for invalid successful payloads and network failures", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: "not-ok" }));
    await expect(new MemoryClient("http://memory.test").health()).rejects.toMatchObject({
      endpoint: "http://memory.test/health",
      status: 200,
      payload: { status: "not-ok" },
    });
    expect(await new MemoryClient("http://memory.test").health().catch((error: unknown) => error)).toBeInstanceOf(
      MemoryClientError,
    );

    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(new MemoryClient("http://memory.test").ready()).rejects.toMatchObject({
      endpoint: "http://memory.test/ready",
      message: "http://memory.test/ready request failed",
    });
  });
});
