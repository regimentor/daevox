import { describe, expect, test, vi } from "vitest";
import {
  ContextMetadataError,
  ContextService,
  normalizeContextWindowTokens,
} from "./context.service.js";

describe("context metadata", () => {
  test("normalizes common context length fields", () => {
    expect(normalizeContextWindowTokens({ context_length: 32768 })).toBe(32768);
    expect(
      normalizeContextWindowTokens({ metadata: { max_model_len: "65536" } }),
    ).toBe(65536);
    expect(
      normalizeContextWindowTokens({ max_position_embeddings: 8192 }),
    ).toBe(8192);
    expect(normalizeContextWindowTokens({ max_tokens: 4096 })).toBeUndefined();
    expect(normalizeContextWindowTokens({ context_length: 0 })).toBeUndefined();
  });

  test("loads the selected model context window from /v1/models", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "other-model", context_length: 2048 },
            { id: "selected-model", max_model_len: 32768 },
          ],
        }),
      ),
    );
    const service = new ContextService({
      baseUrl: "http://model-server/v1",
      model: "selected-model",
      fetch,
    });

    await expect(service.getContextInfo()).resolves.toEqual({
      model: "selected-model",
      contextWindowTokens: 32768,
    });
    expect(fetch).toHaveBeenCalledWith("http://model-server/v1/models");
  });

  test("uses the sole advertised model when the configured name is an alias", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "server-generated-model-id", n_ctx_train: 131072 }],
        }),
      ),
    );
    const service = new ContextService({
      model: "configured-alias",
      fetch,
    });

    await expect(service.getContextInfo()).resolves.toEqual({
      model: "server-generated-model-id",
      contextWindowTokens: 131072,
    });
  });

  test("fails when the selected model does not publish a context length", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "selected-model" }] })),
      );
    const service = new ContextService({ model: "selected-model", fetch });

    await expect(service.getContextInfo()).rejects.toBeInstanceOf(
      ContextMetadataError,
    );
  });
});
