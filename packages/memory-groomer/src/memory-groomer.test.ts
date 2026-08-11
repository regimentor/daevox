import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import OpenAI from "openai";
import type { Message } from "@daevox/contracts";
import {
  MemoryGroomer,
  memoryGroomerSystemPrompt,
  type MemoryGroomerOpenAIClient,
} from "./memory-groomer.js";
import type { MemoryClientLike } from "./tools/memory-client.js";

const { runTools } = vi.hoisted(() => ({ runTools: vi.fn() }));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: { completions: { runTools } },
    };
  }),
}));

const makeMemoryClient = (): MemoryClientLike => ({
  search: vi
    .fn()
    .mockResolvedValue({ query: "q", mode: "hybrid", results: [] }),
  getNote: vi.fn(),
  createNote: vi.fn().mockResolvedValue({ id: "n-1", path: "notes/a.md" }),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
});

const makeMessage = (actor: Message["actor"], content: string): Message => ({
  actor,
  type: actor === "user" ? "user" : "completion",
  content,
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
});

const makeClient = (): MemoryGroomerOpenAIClient => ({
  chat: { completions: { runTools } },
});

describe("MemoryGroomer", () => {
  beforeEach(() => {
    runTools.mockReset();
    vi.stubEnv("OPENAI_API_KEY", "test-api-key");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("instructs the groomer to write human-readable memory fields in Russian", () => {
    expect(memoryGroomerSystemPrompt).toContain(
      "Все новые и изменяемые человекочитаемые поля заметок",
    );
    expect(memoryGroomerSystemPrompt).toContain(
      "Если исходная стенограмма написана не на русском",
    );
    expect(memoryGroomerSystemPrompt).toContain(
      "содержимое и заголовок заметки всё равно должны быть на русском",
    );
  });

  test("creates the OpenAI client and passes model settings, dialogue, prompt, and all tools", async () => {
    runTools.mockReturnValue({
      finalContent: vi.fn().mockResolvedValue("No durable memory changes."),
    });

    const groomer = new MemoryGroomer(
      "http://localhost:8080/v1",
      "memory-model",
      "low",
      { memoryClient: makeMemoryClient() },
    );

    await groomer.groom([
      makeMessage("user", "I prefer concise answers."),
      makeMessage("agent", "Understood."),
    ]);

    expect(OpenAI).toHaveBeenCalledWith({
      baseURL: "http://localhost:8080/v1",
      apiKey: "test-api-key",
    });
    const request = runTools.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "memory-model",
      reasoning_effort: "low",
      stream: true,
      messages: [
        { role: "system", content: memoryGroomerSystemPrompt },
        {
          role: "user",
          content:
            "<dialogue_transcript>\n[message 1 | user]\nI prefer concise answers.\n\n[message 2 | agent]\nUnderstood.\n</dialogue_transcript>",
        },
      ],
    });
    expect(
      request.tools.map(
        (tool: { function: { name: string } }) => tool.function.name,
      ),
    ).toEqual([
      "memory_search",
      "memory_read",
      "memory_create",
      "memory_update",
      "memory_delete",
    ]);
  });

  test("handles an empty dialogue", async () => {
    runTools.mockReturnValue({
      finalContent: vi.fn().mockResolvedValue("Nothing to save."),
    });

    const report = await new MemoryGroomer("http://memory", "model", "medium", {
      openAIClient: makeClient(),
      memoryClient: makeMemoryClient(),
    }).groom([]);

    expect(report).toEqual({ response: "Nothing to save.", toolCalls: [] });
    expect(runTools.mock.calls[0]?.[0].messages).toEqual([
      { role: "system", content: memoryGroomerSystemPrompt },
      {
        role: "user",
        content: "<dialogue_transcript>\n\n</dialogue_transcript>",
      },
    ]);
  });

  test("waits for the tool loop and reports actually executed calls", async () => {
    const memoryClient = makeMemoryClient();
    runTools.mockImplementation((request) => {
      const loop = Promise.resolve().then(async () => {
        const search = request.tools.find(
          (tool: { function: { name: string } }) =>
            tool.function.name === "memory_search",
        );
        const create = request.tools.find(
          (tool: { function: { name: string } }) =>
            tool.function.name === "memory_create",
        );
        await search?.$callback?.({
          query: "concise answers",
          mode: null,
          limit: null,
          path_prefix: null,
          tags: null,
          expand_links: null,
        });
        await create?.$callback?.({
          path: "preferences/answer-style.md",
          title: "Answer style",
          content: "The user prefers concise answers.",
          frontmatter: {},
        });
      });

      return {
        finalContent: async () => {
          await loop;
          return "Saved.";
        },
      };
    });

    const report = await new MemoryGroomer("http://memory", "model", "low", {
      openAIClient: makeClient(),
      memoryClient,
    }).groom([
      makeMessage("user", "Please remember that I prefer concise answers."),
    ]);

    expect(memoryClient.search).toHaveBeenCalledOnce();
    expect(memoryClient.createNote).toHaveBeenCalledOnce();
    expect(report.response).toBe("Saved.");
    expect(report.toolCalls).toHaveLength(2);
    expect(report.toolCalls.map((call) => call.name)).toEqual([
      "memory_search",
      "memory_create",
    ]);
    expect(report.toolCalls.every((call) => call.status === "complete")).toBe(
      true,
    );
  });

  test("logs reasoning metadata from streaming model output", async () => {
    const finalContent = vi.fn().mockResolvedValue("Saved.");
    const chunks = [
      { choices: [{ delta: { reasoning_content: "Search first. " } }] },
      { choices: [{ delta: { reasoning_content: "Then save. " } }] },
    ];
    const completion = {
      finalContent,
      async *[Symbol.asyncIterator]() {
        yield* chunks;
      },
    };
    runTools.mockReturnValue(completion);

    await new MemoryGroomer("http://memory", "model", "low", {
      openAIClient: makeClient(),
      memoryClient: makeMemoryClient(),
    }).groom([makeMessage("user", "Remember this preference.")]);

    expect(finalContent).toHaveBeenCalledOnce();
    expect(console.info).toHaveBeenCalledWith(
      "[memory-groomer] agent reasoning",
      expect.objectContaining({
        event: "agent_reasoning",
        reasoning_available: true,
        reasoning_chars: 25,
        decision: "Saved.",
      }),
    );
  });

  test("propagates model errors", async () => {
    const error = new Error("model unavailable");
    runTools.mockReturnValue({
      finalContent: vi.fn().mockRejectedValue(error),
    });

    await expect(
      new MemoryGroomer("http://memory", "model", "low", {
        openAIClient: makeClient(),
        memoryClient: makeMemoryClient(),
      }).groom([makeMessage("user", "hello")]),
    ).rejects.toBe(error);
  });

  test("does not write memory when the model makes no tool calls", async () => {
    const memoryClient = makeMemoryClient();
    runTools.mockReturnValue({
      finalContent: vi.fn().mockResolvedValue("No changes."),
    });

    const report = await new MemoryGroomer("http://memory", "model", "low", {
      openAIClient: makeClient(),
      memoryClient,
    }).groom([makeMessage("user", "What is the weather?")]);

    expect(report.toolCalls).toEqual([]);
    expect(memoryClient.search).not.toHaveBeenCalled();
    expect(memoryClient.createNote).not.toHaveBeenCalled();
    expect(memoryClient.updateNote).not.toHaveBeenCalled();
    expect(memoryClient.deleteNote).not.toHaveBeenCalled();
  });
});
