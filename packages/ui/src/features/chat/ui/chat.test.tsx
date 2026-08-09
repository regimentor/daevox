import { act } from "react";
import { fork } from "effector";
import { Provider } from "effector-react";
import { describe, expect, test, vi } from "vitest";
import chatStyles from "./chat.module.css";
import messageStyles from "../../../units/message/message.module.css";
import { Chat } from "./chat.js";
import { uiApi } from "../../../api.js";
import {
  $agentStream,
  $messages,
  type AgentStreamState,
  type ChatMessage,
} from "../chat.store.js";
import { render } from "../../../units/test-utils.js";

const renderChat = async (
  messages: ChatMessage[] = [],
  className?: string,
  agentStream: AgentStreamState | null = null,
) => {
  const scope = fork({
    values: [
      [$messages, messages],
      [$agentStream, agentStream],
    ],
  });
  const chat =
    className === undefined ? <Chat /> : <Chat className={className} />;

  const container = await render(<Provider value={scope}>{chat}</Provider>);

  return { container, scope };
};

describe("Chat", () => {
  test("renders the empty state and input", async () => {
    const { container } = await renderChat([], "custom-chat");
    const section = container.querySelector("section");
    const history = container.querySelector('[role="log"]');

    expect(section?.classList.contains(chatStyles.root!)).toBe(true);
    expect(section?.classList.contains("custom-chat")).toBe(true);
    expect(section?.getAttribute("aria-label")).toBe("Chat");
    expect(history?.classList.contains(chatStyles.history!)).toBe(true);
    expect(history?.textContent).toBe("No messages yet.");
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  test("renders user and agent messages with their respective alignment and author", async () => {
    const messages: ChatMessage[] = [
      {
        actor: "user",
        type: "completion",
        content: "Hello",
        createdAt: new Date("2026-08-08T10:30:00.000Z"),
      },
      {
        actor: "agent",
        type: "completion",
        content: "Hi there",
        createdAt: new Date("2026-08-08T10:30:04.000Z"),
      },
    ];
    const { container } = await renderChat(messages);
    const articles = [...container.querySelectorAll("article")];

    expect(articles).toHaveLength(2);
    expect(articles[0]?.classList.contains(messageStyles.right!)).toBe(true);
    expect(
      articles[0]?.querySelector(`.${messageStyles.author!}`)?.textContent,
    ).toBe("You");
    expect(
      articles[0]?.querySelector(`.${messageStyles.body!}`)?.textContent,
    ).toBe("Hello");
    expect(
      articles[0]?.querySelector(`.${messageStyles.timestamp!}`)?.textContent,
    ).toMatch(/\d{1,2}:\d{2}/);
    expect(articles[1]?.classList.contains(messageStyles.left!)).toBe(true);
    expect(
      articles[1]?.querySelector(`.${messageStyles.author!}`)?.textContent,
    ).toBe("Daevox");
    expect(
      articles[1]?.querySelector(`.${messageStyles.body!}`)?.textContent,
    ).toBe("Hi there");
  });

  test("adds a submitted user message to the scoped history", async () => {
    const { container } = await renderChat();
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const form = container.querySelector("form")!;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setValue?.call(textarea, "  New message  ");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    const message = container.querySelector("article");
    expect(message?.classList.contains(messageStyles.right!)).toBe(true);
    expect(
      message?.querySelector(`.${messageStyles.author!}`)?.textContent,
    ).toBe("You");
    expect(message?.querySelector(`.${messageStyles.body!}`)?.textContent).toBe(
      "New message",
    );
    expect(container.querySelector("textarea")?.value).toBe("");
  });

  test("renders the live agent response and thinking state", async () => {
    const { container } = await renderChat([], undefined, {
      requestId: "request-1",
      reasoning: "Checking the available context",
      response: "The streamed answer",
      tools: [
        {
          toolCallId: "tool-1",
          name: "web_search",
          input: '{"query":"Daevox"}',
          status: "complete",
          durationMs: 12,
          error: "",
        },
      ],
      status: "streaming",
    });

    expect(container.querySelectorAll("article")).toHaveLength(1);
    const article = container.querySelector("article");
    expect(article?.querySelector(`.${messageStyles.body!}`)?.textContent).toBe(
      "The streamed answer",
    );
    expect(article?.querySelector("details")?.open).toBe(true);
    expect(article?.querySelector("details")?.textContent).toContain(
      "Checking the available context",
    );
    expect(
      article?.querySelector('[aria-label="Tool calls"]')?.textContent,
    ).toContain("web_search");
    expect(container.querySelector("form details")).toBeNull();
  });

  test("scrolls the page to the newest stream content", async () => {
    const originalDocumentScrollHeight = Object.getOwnPropertyDescriptor(
      document.documentElement,
      "scrollHeight",
    );
    const originalBodyScrollHeight = Object.getOwnPropertyDescriptor(
      document.body,
      "scrollHeight",
    );
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      get: () => 240,
    });
    Object.defineProperty(document.body, "scrollHeight", {
      configurable: true,
      get: () => 240,
    });

    try {
      await renderChat();

      expect(scrollTo).toHaveBeenCalledWith(0, 240);
    } finally {
      if (originalDocumentScrollHeight) {
        Object.defineProperty(
          document.documentElement,
          "scrollHeight",
          originalDocumentScrollHeight,
        );
      } else {
        delete (document.documentElement as { scrollHeight?: number })
          .scrollHeight;
      }
      if (originalBodyScrollHeight) {
        Object.defineProperty(
          document.body,
          "scrollHeight",
          originalBodyScrollHeight,
        );
      } else {
        delete (document.body as { scrollHeight?: number }).scrollHeight;
      }
      scrollTo.mockRestore();
    }
  });

  test("shows a thinking message while a configured agent is responding", async () => {
    let resolveRequest!: () => void;
    const request = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const addMessage = vi.fn(() => request);

    uiApi.setImplementation({
      addMessage,
      onAgentStream: vi.fn(),
      onNewMessage: vi.fn(),
    });

    const { container } = await renderChat();
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setValue?.call(textarea, "Wait for the response");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });

    expect(addMessage).toHaveBeenCalledOnce();
    expect(container.querySelector("article details")?.textContent).toContain(
      "Daevox is thinking…",
    );

    await act(async () => {
      resolveRequest();
      await request;
    });
  });

  test("clears the stream when a configured agent request fails", async () => {
    const addMessage = vi
      .fn()
      .mockRejectedValue(new Error("Agent unavailable"));

    uiApi.setImplementation({
      addMessage,
      onAgentStream: vi.fn(),
      onNewMessage: vi.fn(),
    });

    const { container } = await renderChat();
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setValue?.call(textarea, "Retry this request");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });

    expect(addMessage).toHaveBeenCalledOnce();
    expect(textarea.value).toBe("Retry this request");
  });
});
