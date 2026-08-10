import {
  MemoryClientError,
  type NoteResponse,
} from "@daevox/external-clients";
import { toMemoryToolError, type MemoryToolError } from "../error.js";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import {
  MemoryReadRequestSchema,
  type MemoryReadRequest,
} from "./types.js";

type MemoryReadResult = NoteResponse | MemoryToolError;

const memoryRead = async (
  input: MemoryReadRequest,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<MemoryReadResult> => {
  const request = MemoryReadRequestSchema.parse(input);

  try {
    return await client.getNote(request.note_id);
  } catch (error) {
    if (error instanceof MemoryClientError || error instanceof Error) {
      return toMemoryToolError(error);
    }
    return toMemoryToolError(error);
  }
};

const memory_read = memoryRead;

export { memoryRead, memory_read };
export type { MemoryReadResult };
