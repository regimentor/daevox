import {
  MemoryClientError,
  type NoteResponse,
  type SearchResponse,
  type SearchResult,
} from "@daevox/external-clients";
import { z } from "zod";
import { defaultMemoryClient, type MemoryClientLike } from "./memory-client.js";
import {
  RecallMemoryRequestSchema,
  type RecallMemoryRequest,
} from "./types.js";

type RecallMemoryError = { error: { message: string } };
type RecallMemoryNote = NoteResponse | RecallMemoryError;
type RecallMemoryResult = SearchResult & { note: RecallMemoryNote };
type RecallMemoryResponse = Omit<SearchResponse, "results"> & {
  results: RecallMemoryResult[];
};
type RecallMemoryServiceResult = RecallMemoryResponse | RecallMemoryError;

const memoryServiceUnavailableMessage = "Memory service is unavailable";

const toRecallMemoryError = (error: unknown): RecallMemoryError => {
  if (error instanceof MemoryClientError || error instanceof Error) {
    return { error: { message: error.message } };
  }

  return { error: { message: memoryServiceUnavailableMessage } };
};

const readNote = async (
  noteId: string,
  client: MemoryClientLike,
): Promise<RecallMemoryNote> => {
  try {
    return await client.getNote(noteId);
  } catch (error) {
    return toRecallMemoryError(error);
  }
};

const recallMemory = async (
  input: z.input<typeof RecallMemoryRequestSchema>,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<RecallMemoryServiceResult> => {
  const request: RecallMemoryRequest = RecallMemoryRequestSchema.parse(input);

  let searchResponse: SearchResponse;
  try {
    searchResponse = await client.search(request);
  } catch (error) {
    return toRecallMemoryError(error);
  }

  const notes = new Map<string, Promise<RecallMemoryNote>>();
  for (const result of searchResponse.results) {
    if (!notes.has(result.note_id)) {
      notes.set(result.note_id, readNote(result.note_id, client));
    }
  }

  const results = await Promise.all(
    searchResponse.results.map(async (result): Promise<RecallMemoryResult> => ({
      ...result,
      note: await notes.get(result.note_id)!,
    })),
  );

  return {
    query: searchResponse.query,
    mode: searchResponse.mode,
    results,
  };
};

const recall_memory = recallMemory;

export { recallMemory, recall_memory, toRecallMemoryError };
export type {
  MemoryClientLike,
  RecallMemoryError,
  RecallMemoryNote,
  RecallMemoryResponse,
  RecallMemoryResult,
  RecallMemoryServiceResult,
};
