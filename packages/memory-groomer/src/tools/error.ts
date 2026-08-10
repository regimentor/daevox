import { MemoryClientError } from "@daevox/external-clients";

type MemoryToolError = { error: { message: string } };

const memoryServiceUnavailableMessage = "Memory service is unavailable";

const toMemoryToolError = (error: unknown): MemoryToolError => {
  if (error instanceof MemoryClientError || error instanceof Error) {
    return { error: { message: error.message } };
  }

  return { error: { message: memoryServiceUnavailableMessage } };
};

export { toMemoryToolError };
export type { MemoryToolError };
