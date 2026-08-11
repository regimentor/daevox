import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryClientError } from "@daevox/external-clients";
import { AgentToolService } from "../tool-service.js";
import { recallMemory } from "./service.js";
import { createRecallMemoryTool } from "./tool.js";
import {
  RecallMemoryRequestSchema,
  RecallMemoryToolRequestSchema,
} from "./types.js";
import type { MemoryClientLike } from "./memory-client.js";

const makeClient = (): MemoryClientLike => ({
  search: vi.fn(),
  getNote: vi.fn(),
});

const searchResult = (noteId: string, score: number, chunkId: string) => ({
  note_id: noteId,
  path: `${noteId}.md`,
  title: noteId,
  heading_path: ["Preferences"],
  content: `matching chunk ${chunkId}`,
  score,
  keyword_score: score,
  semantic_score: null,
  chunk_id: chunkId,
});

describe("recall_memory schemas", () => {
  test("defaults retrieval mode and limit and rejects invalid input", () => {
    expect(RecallMemoryRequestSchema.parse({ query: " preferences " })).toEqual(
      {
        query: "preferences",
        mode: "hybrid",
        limit: 5,
      },
    );
    expect(RecallMemoryRequestSchema.safeParse({ query: "" }).success).toBe(
      false,
    );
    expect(
      RecallMemoryRequestSchema.safeParse({ query: "q", mode: "invalid" })
        .success,
    ).toBe(false);
    expect(
      RecallMemoryRequestSchema.safeParse({ query: "q", limit: 11 }).success,
    ).toBe(false);
    expect(
      RecallMemoryRequestSchema.safeParse({ query: "q", path_prefix: "" })
        .success,
    ).toBe(false);
    expect(
      RecallMemoryRequestSchema.safeParse({ query: "q", extra: true }).success,
    ).toBe(false);
  });

  test("uses nullable fields for OpenAI strict tool arguments", () => {
    expect(
      RecallMemoryToolRequestSchema.parse({
        query: "preferences",
        mode: null,
        limit: null,
        path_prefix: null,
        tags: null,
        expand_links: null,
      }),
    ).toMatchObject({ query: "preferences", mode: null, limit: null });
    expect(
      RecallMemoryToolRequestSchema.safeParse({ query: "preferences" }).success,
    ).toBe(false);
  });
});

describe("recallMemory", () => {
  let client: MemoryClientLike;

  beforeEach(() => {
    client = makeClient();
  });

  test("searches with defaults, deduplicates reads and preserves result order and scores", async () => {
    vi.mocked(client.search).mockResolvedValue({
      query: "preferences",
      mode: "hybrid",
      results: [
        searchResult("note-1", 0.92, "chunk-1"),
        searchResult("note-1", 0.81, "chunk-2"),
        searchResult("note-2", 0.73, "chunk-3"),
      ],
    });
    vi.mocked(client.getNote).mockImplementation(async (noteId) => ({
      id: noteId,
      path: `${noteId}.md`,
      title: noteId,
      content: `full ${noteId}`,
      raw: `# ${noteId}\n\nfull ${noteId}`,
      frontmatter: {},
    }));

    await expect(
      recallMemory({ query: " preferences " }, client),
    ).resolves.toEqual({
      query: "preferences",
      mode: "hybrid",
      results: [
        {
          ...searchResult("note-1", 0.92, "chunk-1"),
          note: expect.objectContaining({
            id: "note-1",
            content: "full note-1",
          }),
        },
        {
          ...searchResult("note-1", 0.81, "chunk-2"),
          note: expect.objectContaining({
            id: "note-1",
            content: "full note-1",
          }),
        },
        {
          ...searchResult("note-2", 0.73, "chunk-3"),
          note: expect.objectContaining({
            id: "note-2",
            content: "full note-2",
          }),
        },
      ],
    });

    expect(client.search).toHaveBeenCalledWith({
      query: "preferences",
      mode: "hybrid",
      limit: 5,
    });
    expect(client.getNote).toHaveBeenCalledTimes(2);
    expect(client.getNote).toHaveBeenNthCalledWith(1, "note-1");
    expect(client.getNote).toHaveBeenNthCalledWith(2, "note-2");
  });

  test("keeps other results when one note cannot be read", async () => {
    vi.mocked(client.search).mockResolvedValue({
      query: "context",
      mode: "keyword",
      results: [
        searchResult("missing", 0.9, "chunk-1"),
        searchResult("ok", 0.8, "chunk-2"),
      ],
    });
    vi.mocked(client.getNote).mockImplementation(async (noteId) => {
      if (noteId === "missing") {
        throw new MemoryClientError("note is missing", { endpoint: "memory" });
      }
      return {
        id: noteId,
        path: "ok.md",
        title: "OK",
        content: "full content",
        raw: "full content",
        frontmatter: {},
      };
    });

    await expect(
      recallMemory(
        {
          query: "context",
          mode: "keyword",
          limit: 2,
          path_prefix: "notes",
          tags: ["work"],
          expand_links: true,
        },
        client,
      ),
    ).resolves.toMatchObject({
      results: [
        { note_id: "missing", note: { error: { message: "note is missing" } } },
        { note_id: "ok", note: { id: "ok", content: "full content" } },
      ],
    });
    expect(client.search).toHaveBeenCalledWith({
      query: "context",
      mode: "keyword",
      limit: 2,
      path_prefix: "notes",
      tags: ["work"],
      expand_links: true,
    });
  });

  test("converts search and unknown failures to tool errors", async () => {
    vi.mocked(client.search).mockRejectedValueOnce(new Error("offline"));
    await expect(recallMemory({ query: "q" }, client)).resolves.toEqual({
      error: { message: "offline" },
    });

    vi.mocked(client.search).mockRejectedValueOnce("bad failure");
    await expect(recallMemory({ query: "q" }, client)).resolves.toEqual({
      error: { message: "Memory service is unavailable" },
    });
  });
});

describe("recall_memory tools", () => {
  test("exposes the OpenAI name and routes nullable arguments through the logger", async () => {
    const client = makeClient();
    vi.mocked(client.search).mockResolvedValue({
      query: "q",
      mode: "hybrid",
      results: [],
    });
    const logger = { run: vi.fn((_name, _input, call) => call()) };
    const tool = createRecallMemoryTool(logger as never, client);

    expect(tool.function.name).toBe("recall_memory");
    expect(tool.function.parameters?.required).toEqual([
      "query",
      "mode",
      "limit",
      "path_prefix",
      "tags",
      "expand_links",
    ]);
    await tool.$callback?.({
      query: "q",
      mode: null,
      limit: null,
      path_prefix: null,
      tags: null,
      expand_links: null,
    });
    expect(logger.run).toHaveBeenCalledWith(
      "recall_memory",
      expect.objectContaining({ query: "q" }),
      expect.any(Function),
    );
  });

  test("treats a model-emitted string null path prefix as unset", async () => {
    const client = makeClient();
    vi.mocked(client.search).mockResolvedValue({
      query: "ИИ эксперименты",
      mode: "hybrid",
      results: [],
    });
    const tool = createRecallMemoryTool(undefined, client);

    await tool.$callback?.({
      query: "ИИ эксперименты",
      mode: null,
      limit: null,
      path_prefix: "null",
      tags: null,
      expand_links: false,
    });

    expect(client.search).toHaveBeenCalledWith({
      query: "ИИ эксперименты",
      mode: "hybrid",
      limit: 5,
      expand_links: false,
    });
  });

  test("is part of the standard agent tool set", () => {
    expect(
      new AgentToolService().tools.map((tool) => tool.function.name),
    ).toEqual(["web_search", "web_open", "recall_memory"]);
  });
});
