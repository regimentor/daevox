import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  WebOpenPayloadSchema,
  WebSearchClient,
  WebSearchClientError,
  WebSearchEndpoint,
  WebSearchPayloadSchema,
} from "./web-search.js";

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const searchPayload = {
  query: "typescript",
  results: [
    {
      position: 1,
      title: "TypeScript",
      url: "https://www.typescriptlang.org/",
      snippet: "TypeScript is JavaScript with syntax for types.",
      source: "typescriptlang.org",
    },
  ],
  meta: { count: 1, elapsed_ms: 12 },
};

const openPayload = {
  url: "https://example.com/article",
  final_url: "https://example.com/article",
  canonical_url: "https://example.com/article",
  title: "An article",
  content_type: "text/html",
  fetch_mode: "http",
  status_code: 200,
  content: "Article content",
  char_count: 15,
  original_char_count: 15,
  truncated: false,
  meta: { elapsed_ms: 24, requested_fragment: null },
};

describe("WebSearchClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.stubEnv("WEB_SEARCH_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("performs web_search with normalized URL, JSON and bearer authorization", async () => {
    fetchMock.mockResolvedValue(jsonResponse(searchPayload));

    await expect(
      new WebSearchClient("http://search.test///").request(
        WebSearchEndpoint.WebSearch,
        { query: "typescript", max_results: 3 },
      ),
    ).resolves.toEqual(searchPayload);

    expect(fetchMock).toHaveBeenCalledWith("http://search.test/v1/web_search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-key",
      },
      body: JSON.stringify({ query: "typescript", max_results: 3 }),
    });
    expect(WebSearchPayloadSchema.parse(searchPayload)).toEqual(searchPayload);
  });

  test("performs web_open through both request and convenience APIs", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(openPayload))
      .mockResolvedValueOnce(jsonResponse(openPayload));
    const client = new WebSearchClient();

    await expect(
      client.request(WebSearchEndpoint.WebOpen, {
        url: "https://example.com/article",
        render: "browser",
        max_chars: 10_000,
      }),
    ).resolves.toEqual(openPayload);
    await expect(
      client.webOpen({ url: "https://example.com/article" }),
    ).resolves.toEqual(openPayload);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:9000/v1/web_open",
      "http://127.0.0.1:9000/v1/web_open",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        url: "https://example.com/article",
        render: "browser",
        max_chars: 10_000,
      }),
    });
    expect(WebOpenPayloadSchema.parse(openPayload)).toEqual(openPayload);
  });

  test("does not send authorization when the API key is absent", async () => {
    vi.stubEnv("WEB_SEARCH_API_KEY", "");
    fetchMock.mockResolvedValue(jsonResponse(searchPayload));

    await new WebSearchClient("http://search.test").webSearch({
      query: "typescript",
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { "content-type": "application/json" },
    });
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({
      headers: { authorization: expect.anything() },
    });
  });

  test("throws a typed error for HTTP failures and retains structured error payloads", async () => {
    const payload = { error: { message: "rate limited" } };
    fetchMock.mockResolvedValue(jsonResponse(payload, 429));

    const error = await new WebSearchClient("http://search.test")
      .webSearch({ query: "typescript" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WebSearchClientError);
    expect(error).toMatchObject({
      endpoint: "http://search.test/v1/web_search",
      status: 429,
      payload,
      errorResponse: payload,
      message: "rate limited",
    });
  });

  test("throws typed errors for invalid successful payloads and network failures", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ query: "typescript", results: [] }),
    );
    await expect(
      new WebSearchClient("http://search.test").webSearch({
        query: "typescript",
      }),
    ).rejects.toMatchObject({
      endpoint: "http://search.test/v1/web_search",
      status: 200,
      message: "web_search returned an invalid payload",
    });

    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(
      new WebSearchClient("http://search.test").webOpen({
        url: "https://example.com",
      }),
    ).rejects.toMatchObject({
      endpoint: "http://search.test/v1/web_open",
      message: "offline",
    });
  });

  test("validates request payloads before making a request", async () => {
    await expect(
      new WebSearchClient("http://search.test").webSearch({ query: "" }),
    ).rejects.toThrow("query must be a non-empty string");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
