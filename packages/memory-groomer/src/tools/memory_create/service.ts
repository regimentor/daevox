import {
  MemoryClientError,
  type NoteMutationResponse,
} from "@daevox/external-clients";
import { z } from "zod";
import { toMemoryToolError, type MemoryToolError } from "../error.js";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import {
  MemoryCreateRequestSchema,
  type MemoryCreateRequest,
} from "./types.js";

type MemoryCreateResult = NoteMutationResponse | MemoryToolError;

const memoryCreate = async (
  input: z.input<typeof MemoryCreateRequestSchema>,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<MemoryCreateResult> => {
  const request = MemoryCreateRequestSchema.parse(input);

  try {
    return await client.createNote(request);
  } catch (error) {
    if (error instanceof MemoryClientError || error instanceof Error) {
      return toMemoryToolError(error);
    }
    return toMemoryToolError(error);
  }
};

const memory_create = memoryCreate;

export { memoryCreate, memory_create };
export type { MemoryCreateResult };
