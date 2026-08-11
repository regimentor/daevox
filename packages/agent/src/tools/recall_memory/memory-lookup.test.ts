import { describe, expect, test, vi } from "vitest";
import type { MemoryClientLike } from "./memory-client.js";
import { lookupMemory } from "./memory-lookup.js";

const result = (noteId: string, title = noteId) => ({
  note_id: noteId,
  path: `${noteId}.md`,
  title,
  heading_path: [],
  content: "matching chunk",
  score: 1,
  chunk_id: `${noteId}-chunk`,
});

const client = (): MemoryClientLike => ({
  search: vi.fn(),
  getNote: vi.fn(),
});

describe("lookupMemory", () => {
  test("uses hybrid search, returns note summaries and full note context", async () => {
    const memoryClient = client();
    vi.mocked(memoryClient.search).mockResolvedValue({
      query: "GPU",
      mode: "hybrid",
      results: [result("hardware", "Hardware"), result("hardware", "Hardware")],
    });
    vi.mocked(memoryClient.getNote).mockResolvedValue({
      id: "hardware",
      path: "hardware.md",
      title: "Hardware",
      content: "The machine has a local GPU.",
      raw: "The machine has a local GPU.",
      frontmatter: {},
    });

    const response = await lookupMemory("GPU", memoryClient);

    expect(response.lookup).toMatchObject({
      status: "complete",
      query: "GPU",
      resultCount: 1,
      results: [{ title: "Hardware", path: "hardware.md" }],
      error: "",
    });
    expect(response.lookup.durationMs).toBeGreaterThanOrEqual(0);
    expect(response.context).toContain("The machine has a local GPU.");
    expect(memoryClient.search).toHaveBeenCalledWith({
      query: "GPU",
      mode: "hybrid",
      limit: 5,
    });
  });

  test("turns memory failures into an error lookup without throwing", async () => {
    const memoryClient = client();
    vi.mocked(memoryClient.search).mockRejectedValue(new Error("offline"));

    await expect(lookupMemory("GPU", memoryClient)).resolves.toMatchObject({
      lookup: {
        status: "error",
        query: "GPU",
        resultCount: 0,
        results: [],
        error: "offline",
      },
      context: "",
    });
  });
});
