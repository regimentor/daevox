import { MemoryClientError } from "@daevox/external-clients";
import { toMemoryToolError, type MemoryToolError } from "../error.js";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import {
  MemoryDeleteRequestSchema,
  type MemoryDeleteRequest,
} from "./types.js";

type MemoryDeleteSuccess = { deleted: true; note_id: string };
type MemoryDeleteResult = MemoryDeleteSuccess | MemoryToolError;

const memoryDelete = async (
  input: MemoryDeleteRequest,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<MemoryDeleteResult> => {
  const request = MemoryDeleteRequestSchema.parse(input);

  try {
    await client.deleteNote(request.note_id);
    return { deleted: true, note_id: request.note_id };
  } catch (error) {
    if (error instanceof MemoryClientError || error instanceof Error) {
      return toMemoryToolError(error);
    }
    return toMemoryToolError(error);
  }
};

const memory_delete = memoryDelete;

export { memoryDelete, memory_delete };
export type { MemoryDeleteResult, MemoryDeleteSuccess };
