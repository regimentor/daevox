import {
  type SearchResponse,
  MemoryClientError,
} from "@daevox/external-clients";
import { z } from "zod";
import { toMemoryToolError, type MemoryToolError } from "../error.js";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import {
  MemorySearchRequestSchema,
  type MemorySearchRequest,
} from "./types.js";

type MemorySearchResult = SearchResponse | MemoryToolError;

const memorySearch = async (
  input: z.input<typeof MemorySearchRequestSchema>,
  client: MemoryClientLike = defaultMemoryClient,
): Promise<MemorySearchResult> => {
  const request = MemorySearchRequestSchema.parse(input);

  try {
    return await client.search(request);
  } catch (error) {
    if (error instanceof MemoryClientError || error instanceof Error) {
      return toMemoryToolError(error);
    }
    return toMemoryToolError(error);
  }
};

const memory_search = memorySearch;

export { memorySearch, memory_search };
export type { MemorySearchResult };
