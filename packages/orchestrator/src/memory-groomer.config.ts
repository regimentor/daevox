import type { MemoryGroomer } from "@daevox/memory-groomer";

type MemoryGroomerConfig = {
  baseUrl: string;
  model: string;
  reasoningEffort: ConstructorParameters<typeof MemoryGroomer>[2];
  memoryServiceUrl: string;
};

const defaultMemoryGroomerConfig = (): MemoryGroomerConfig => ({
  baseUrl:
    process.env.DAEVOX_MEMORY_GROOMER_BASE_URL ?? "http://localhost:8080/v1",
  model:
    process.env.DAEVOX_MEMORY_GROOMER_MODEL ??
    process.env.DAEVOX_MODEL ??
    "unsloth/GLM-4.7-Flash-GGUF:UD-Q4_K_XL",
  reasoningEffort: "xhigh",
  memoryServiceUrl:
    process.env.MEMORY_SERVICE_URL ?? "http://127.0.0.1:8765",
});

export { defaultMemoryGroomerConfig };
export type { MemoryGroomerConfig };
