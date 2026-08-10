import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  MemoryCreateRequestSchema,
  MemoryCreateToolRequestSchema,
} from "./memory_create/types.js";
import { memoryCreate } from "./memory_create/service.js";
import { createMemoryCreateTool } from "./memory_create/tool.js";
import {
  MemoryDeleteRequestSchema,
  MemoryDeleteToolRequestSchema,
} from "./memory_delete/types.js";
import { memoryDelete } from "./memory_delete/service.js";
import { createMemoryDeleteTool } from "./memory_delete/tool.js";
import { MemoryClientError } from "@daevox/external-clients";
import {
  MemoryReadRequestSchema,
  MemoryReadToolRequestSchema,
} from "./memory_read/types.js";
import { memoryRead } from "./memory_read/service.js";
import {
  MemorySearchRequestSchema,
  MemorySearchToolRequestSchema,
} from "./memory_search/types.js";
import { memorySearch } from "./memory_search/service.js";
import { createMemorySearchTool } from "./memory_search/tool.js";
import {
  MemoryUpdateRequestSchema,
  MemoryUpdateToolRequestSchema,
} from "./memory_update/types.js";
import { memoryUpdate } from "./memory_update/service.js";
import { createMemoryUpdateTool } from "./memory_update/tool.js";
import type { MemoryClientLike } from "./memory-client.js";

const makeClient = (): MemoryClientLike => ({
  search: vi.fn(),
  getNote: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
});

describe("memory groomer schemas", () => {
  test("preserve Memory API defaults", () => {
    expect(MemorySearchRequestSchema.parse({ query: "meeting" })).toEqual({
      query: "meeting",
      mode: "hybrid",
      tags: [],
      expand_links: false,
    });
    expect(MemoryCreateRequestSchema.parse({ path: "notes/a.md" })).toEqual({
      path: "notes/a.md",
      content: "",
      frontmatter: {},
    });
    expect(
      MemoryCreateToolRequestSchema.safeParse({
        path: "nodejs/tech-stack",
        title: null,
        content: null,
        frontmatter: null,
      }).success,
    ).toBe(false);
  });

  test("require tool fields and accept nullable optional API fields", () => {
    expect(
      MemorySearchToolRequestSchema.parse({
        query: "meeting",
        mode: null,
        limit: null,
        path_prefix: null,
        tags: null,
        expand_links: null,
      }),
    ).toMatchObject({ query: "meeting", mode: null, tags: null });
    expect(
      MemoryCreateToolRequestSchema.parse({
        path: "notes/a.md",
        title: null,
        content: null,
        frontmatter: null,
      }),
    ).toMatchObject({ path: "notes/a.md", frontmatter: null });
    expect(MemoryReadToolRequestSchema.parse({ note_id: "n-1" })).toEqual({
      note_id: "n-1",
    });
    expect(MemoryDeleteToolRequestSchema.parse({ note_id: "n-1" })).toEqual({
      note_id: "n-1",
    });
    expect(
      MemoryUpdateToolRequestSchema.parse({
        note_id: "n-1",
        path: null,
        title: null,
        content: null,
        frontmatter: null,
      }),
    ).toMatchObject({ note_id: "n-1", content: null });
    expect(MemoryReadRequestSchema.safeParse({}).success).toBe(false);
    expect(MemoryDeleteRequestSchema.safeParse({}).success).toBe(false);
    expect(MemoryUpdateRequestSchema.safeParse({ note_id: "n-1" }).success).toBe(
      true,
    );
  });
});

describe("memory groomer services", () => {
  let client: MemoryClientLike;

  beforeEach(() => {
    client = makeClient();
  });

  test("delegates search, read, create and update requests", async () => {
    vi.mocked(client.search).mockResolvedValue({
      query: "q",
      mode: "hybrid",
      results: [],
    });
    vi.mocked(client.getNote).mockResolvedValue({
      id: "n-1",
      path: "notes/a.md",
      title: "A",
      content: "body",
      raw: "body",
      frontmatter: {},
    });
    vi.mocked(client.createNote).mockResolvedValue({ id: "n-1", path: "notes/a.md" });
    vi.mocked(client.updateNote).mockResolvedValue({ id: "n-1", path: "notes/b.md" });

    await expect(
      memorySearch({ query: "q", mode: "hybrid", tags: [], expand_links: false }, client),
    ).resolves.toMatchObject({ query: "q" });
    await expect(memoryRead({ note_id: "n-1" }, client)).resolves.toMatchObject({ id: "n-1" });
    await expect(memoryCreate({ path: "notes/a.md" }, client)).resolves.toEqual({
      id: "n-1",
      path: "notes/a.md",
    });
    await expect(memoryUpdate({ note_id: "n-1", content: "new body" }, client)).resolves.toEqual({
      id: "n-1",
      path: "notes/b.md",
    });

    expect(client.search).toHaveBeenCalledWith({
      query: "q",
      mode: "hybrid",
      tags: [],
      expand_links: false,
    });
    expect(client.getNote).toHaveBeenCalledWith("n-1");
    expect(client.createNote).toHaveBeenCalledWith({
      path: "notes/a.md",
      content: "",
      frontmatter: {},
    });
    expect(client.updateNote).toHaveBeenCalledWith("n-1", { content: "new body" });
  });

  test("converts client and ordinary errors into tool errors", async () => {
    vi.mocked(client.getNote).mockRejectedValue(
      new MemoryClientError("missing note", { endpoint: "memory" }),
    );
    vi.mocked(client.search).mockRejectedValue(new Error("offline"));

    await expect(memoryRead({ note_id: "n-1" }, client)).resolves.toEqual({
      error: { message: "missing note" },
    });
    await expect(
      memorySearch({ query: "q", mode: "hybrid", tags: [], expand_links: false }, client),
    ).resolves.toEqual({ error: { message: "offline" } });
  });

  test("returns a stable result after a successful 204 delete", async () => {
    vi.mocked(client.deleteNote).mockResolvedValue();

    await expect(memoryDelete({ note_id: "n-1" }, client)).resolves.toEqual({
      deleted: true,
      note_id: "n-1",
    });
    expect(client.deleteNote).toHaveBeenCalledWith("n-1");
  });
});

describe("memory groomer tool factories", () => {
  test("expose the OpenAI names and route callbacks through the logger", async () => {
    const client = makeClient();
    vi.mocked(client.deleteNote).mockResolvedValue();
    const logger = { run: vi.fn((_name, _input, call) => call()) };
    const tool = createMemoryDeleteTool(logger as never, client);

    expect(tool.function.name).toBe("memory_delete");
    expect(tool.function.parameters?.required).toEqual(["note_id"]);
    await tool.$callback?.({ note_id: "n-1" });
    expect(logger.run).toHaveBeenCalledWith(
      "memory_delete",
      { note_id: "n-1" },
      expect.any(Function),
    );
  });

  test("create the remaining tool definitions with their exact names", () => {
    expect(createMemorySearchTool().function.name).toBe("memory_search");
    expect(createMemoryCreateTool().function.name).toBe("memory_create");
    expect(createMemoryUpdateTool().function.name).toBe("memory_update");
  });
});
