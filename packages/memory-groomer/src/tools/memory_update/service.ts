import {
  MemoryClientError,
  type NoteMutationResponse,
} from "@daevox/external-clients";
import { z } from "zod";
import { toMemoryToolError, type MemoryToolError } from "../error.js";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import {
  MemoryUpdateRequestSchema,
  type MemoryUpdateRequest,
} from "./types.js";

type MemoryUpdateResult = NoteMutationResponse | MemoryToolError;

const memoryUpdate = async (
  input: z.input<typeof MemoryUpdateRequestSchema>,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<MemoryUpdateResult> => {
  const request = MemoryUpdateRequestSchema.parse(input);

  try {
    const { note_id, ...payload } = request;
    return await client.updateNote(note_id, payload);
  } catch (error) {
    if (error instanceof MemoryClientError || error instanceof Error) {
      return toMemoryToolError(error);
    }
    return toMemoryToolError(error);
  }
};

const memory_update = memoryUpdate;

export { memoryUpdate, memory_update };
export type { MemoryUpdateResult };
