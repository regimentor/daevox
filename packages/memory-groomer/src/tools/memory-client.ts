import { MemoryClient } from "@daevox/external-clients";

const defaultMemoryServiceUrl =
  process.env.MEMORY_SERVICE_URL ?? "http://127.0.0.1:8765";

type MemoryClientLike = Pick<
  MemoryClient,
  "search" | "getNote" | "createNote" | "updateNote" | "deleteNote"
>;

const createMemoryClient = (baseUrl = defaultMemoryServiceUrl) =>
  new MemoryClient(baseUrl);

const defaultMemoryClient = createMemoryClient();

export {
  createMemoryClient,
  defaultMemoryClient,
  defaultMemoryServiceUrl,
};
export type { MemoryClientLike };
