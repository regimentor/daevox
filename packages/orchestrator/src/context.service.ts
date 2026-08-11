import type { ContextInfo } from "@daevox/contracts";
import { ContextInfoSchema } from "@daevox/contracts";
import { Injectable, Optional } from "@nestjs/common";

const defaultModel = "unsloth/GLM-4.7-Flash-GGUF:UD-Q4_K_XL";
const defaultBaseUrl = "http://localhost:8080/v1";

const contextFieldNames = new Set([
  "contextlength",
  "contextsize",
  "contextwindow",
  "contextwindowtokens",
  "maxcontextlength",
  "maxmodellength",
  "maxmodellen",
  "maxmodeltokens",
  "maxpositionembeddings",
  "maxseqlen",
  "maxsequencelength",
  "modellength",
  "modelmaxlength",
  "modelcontextlength",
  "nctx",
  "nctxtrain",
]);

type MetadataRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is MetadataRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizedKey = (key: string): string =>
  key.replace(/[._-]/g, "").toLowerCase();

const positiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  const number = typeof value === "number" ? value : Number(value.trim());
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
};

const findContextLength = (value: unknown, depth = 0): number | undefined => {
  if (depth > 4 || !isRecord(value)) {
    return undefined;
  }

  for (const [key, candidate] of Object.entries(value)) {
    if (contextFieldNames.has(normalizedKey(key))) {
      const length = positiveInteger(candidate);
      if (length !== undefined) {
        return length;
      }
    }
  }

  for (const candidate of Object.values(value)) {
    const length = findContextLength(candidate, depth + 1);
    if (length !== undefined) {
      return length;
    }
  }

  return undefined;
};

const normalizeContextWindowTokens = (metadata: unknown): number | undefined =>
  findContextLength(metadata);

const modelId = (metadata: unknown): string | undefined => {
  if (!isRecord(metadata)) {
    return undefined;
  }

  for (const key of ["id", "model", "name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
};

const modelEntries = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
};

const findSelectedModel = (
  payload: unknown,
  selectedModel: string,
): unknown | undefined => {
  const entries = modelEntries(payload);
  const selected = entries.find((entry) => modelId(entry) === selectedModel);

  // Some OpenAI-compatible local servers expose a generated/path-based model
  // id even though they accept DAEVOX_MODEL as an alias. With one advertised
  // model, its context metadata is still unambiguous.
  return selected ?? (entries.length === 1 ? entries[0] : undefined);
};

type ContextServiceOptions = {
  baseUrl?: string;
  model?: string;
  fetch?: typeof globalThis.fetch;
};

class ContextMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextMetadataError";
  }
}

@Injectable()
class ContextService {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(@Optional() options: ContextServiceOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.DAEVOX_OPENAI_BASE_URL ??
      defaultBaseUrl
    ).replace(/\/$/, "");
    this.model = options.model ?? process.env.DAEVOX_MODEL ?? defaultModel;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async getContextInfo(): Promise<ContextInfo> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/models`);
    } catch (error) {
      throw new ContextMetadataError(
        `Unable to fetch model metadata: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }

    if (!response.ok) {
      throw new ContextMetadataError(
        `Model metadata endpoint returned HTTP ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ContextMetadataError(
        "Model metadata response is not valid JSON",
      );
    }

    const selected = findSelectedModel(payload, this.model);
    if (selected === undefined) {
      throw new ContextMetadataError(
        `Model ${this.model} was not found in the model metadata`,
      );
    }

    const contextWindowTokens = normalizeContextWindowTokens(selected);
    if (contextWindowTokens === undefined) {
      throw new ContextMetadataError(
        `Model ${this.model} does not publish a recognized context length`,
      );
    }

    return ContextInfoSchema.parse({
      model: modelId(selected) ?? this.model,
      contextWindowTokens,
    });
  }
}

export {
  ContextMetadataError,
  ContextService,
  findSelectedModel,
  normalizeContextWindowTokens,
};
export type { ContextServiceOptions };
