import type {
  AgentMemoryLookup,
  AgentMemoryLookupResult,
} from "@daevox/contracts";
import type { NoteResponse } from "@daevox/external-clients";
import { defaultMemoryClient, type MemoryClientLike } from "./memory-client.js";
import { recallMemory, type RecallMemoryResponse } from "./service.js";

type MemoryLookupResult = {
  lookup: AgentMemoryLookup;
  context: string;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Memory service is unavailable";

const noteKey = (result: { note_id: string; path: string }) =>
  `${result.note_id}:${result.path}`;

const toContext = (response: RecallMemoryResponse): string => {
  const notes = new Map<string, NoteResponse>();

  for (const result of response.results) {
    if ("content" in result.note && !notes.has(result.note_id)) {
      notes.set(result.note_id, result.note);
    }
  }

  return [...notes.values()]
    .map(
      (note) => `[Memory note: ${note.title} | ${note.path}]\n${note.content}`,
    )
    .join("\n\n");
};

const lookupMemory = async (
  query: string,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<MemoryLookupResult> => {
  const startedAt = performance.now();
  const baseLookup = {
    query,
    resultCount: 0,
    results: [] as AgentMemoryLookupResult[],
    error: "",
  };

  try {
    const response = await recallMemory(
      { query, mode: "hybrid", limit: 5 },
      client,
    );

    if ("error" in response) {
      return {
        lookup: {
          ...baseLookup,
          status: "error",
          durationMs: Math.round(performance.now() - startedAt),
          error: response.error.message,
        },
        context: "",
      };
    }

    const summaries = new Map<string, AgentMemoryLookupResult>();
    for (const result of response.results) {
      const key = noteKey(result);
      if (!summaries.has(key)) {
        summaries.set(key, { title: result.title, path: result.path });
      }
    }

    return {
      lookup: {
        ...baseLookup,
        status: "complete",
        durationMs: Math.round(performance.now() - startedAt),
        resultCount: summaries.size,
        results: [...summaries.values()],
      },
      context: toContext(response),
    };
  } catch (error) {
    return {
      lookup: {
        ...baseLookup,
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        error: errorMessage(error),
      },
      context: "",
    };
  }
};

export { lookupMemory };
export type { MemoryLookupResult };
