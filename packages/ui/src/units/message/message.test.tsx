import { describe, expect, test, vi } from "vitest";
import thinkingStyles from "../thinking/thinking.module.css";
import sourcesStyles from "../sources/sources.module.css";
import styles from "./message.module.css";
import { Message } from "./message.js";
import { render } from "../test-utils.js";

describe("Message", () => {
  test("renders an incoming message with the copy action before its timestamp", async () => {
    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        The deployment completed successfully.
      </Message>,
    );
    const article = container.querySelector("article");
    const content = article?.querySelector(`.${styles.content}`);
    const footer = article?.querySelector(`.${styles.footer}`);

    expect(article?.classList.contains(styles.left!)).toBe(true);
    expect(article?.querySelector(`.${styles.accent!}`)).not.toBeNull();
    expect(content?.querySelector(`.${styles.author!}`)?.textContent).toBe(
      "Daevox",
    );
    expect(content?.querySelector(`.${styles.body!}`)?.textContent).toBe(
      "The deployment completed successfully.",
    );
    expect(content?.querySelector(`.${styles.timestamp!}`)?.textContent).toBe(
      "12:34",
    );
    expect(footer?.children.item(0)?.querySelector("button")).not.toBeNull();
    expect(footer?.querySelector("img")).toBeNull();
    expect(footer?.querySelector("svg")).not.toBeNull();
    expect(
      footer?.children.item(1)?.classList.contains(styles.timestamp!),
    ).toBe(true);
  });

  test("renders outgoing messages on the right and places copy after the timestamp", async () => {
    const container = await render(
      <Message alignment="right" author="You" timestamp="12:35">
        Great, thank you!
      </Message>,
    );
    const article = container.querySelector("article");
    const footer = article?.querySelector(`.${styles.footer}`);

    expect(article?.classList.contains(styles.right!)).toBe(true);
    expect(article?.querySelectorAll(`.${styles.accent!}`).length).toBe(1);
    expect(
      footer?.children.item(0)?.classList.contains(styles.timestamp!),
    ).toBe(true);
    expect(footer?.children.item(1)?.querySelector("button")).not.toBeNull();
  });

  test("renders Markdown and preserves line breaks in string messages", async () => {
    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        {"**Bold**\nSecond line\n\n- First item\n- Second item"}
      </Message>,
    );
    const body = container.querySelector(`.${styles.body}`);

    expect(body?.querySelector("strong")?.textContent).toBe("Bold");
    expect(body?.querySelector("ul")).not.toBeNull();
    expect(body?.textContent).toContain("Bold\nSecond line");
  });

  test("renders GFM tables", async () => {
    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        {"| Name | Status |\n| --- | --- |\n| API | Ready |"}
      </Message>,
    );
    const table = container.querySelector(`.${styles.body} table`);

    expect(table).not.toBeNull();
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(table?.textContent).toContain("API");
  });

  test("highlights supported fenced code and keeps unknown languages safe", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const highlighted = await render(
      <Message author="Daevox" timestamp="12:34">
        {'```typescript\nconst answer: string = "yes";\n```'}
      </Message>,
    );
    const highlightedCode = highlighted.querySelector(`.${styles.codeBlock}`);

    expect(
      highlightedCode?.querySelector(`.${styles.codeLanguage}`)?.textContent,
    ).toBe("typescript");
    expect(highlightedCode?.textContent).toContain("const answer");
    expect(highlightedCode?.querySelectorAll("span").length).toBeGreaterThan(0);
    highlightedCode
      ?.querySelector<HTMLButtonElement>('button[aria-label="Copy code"]')
      ?.click();
    expect(writeText).toHaveBeenCalledWith('const answer: string = "yes";');

    const unknown = await render(
      <Message author="Daevox" timestamp="12:34">
        {"```unknown-language\nplain text\n```"}
      </Message>,
    );

    expect(unknown.querySelector("script")).toBeNull();
    expect(
      unknown.querySelector(`.${styles.codeBlock} code`)?.textContent,
    ).toContain("plain text");

    expect(
      unknown.querySelector(`.${styles.codeLanguage}`)?.textContent,
    ).toBe("unknown-language");

    const unlabeled = await render(
      <Message author="Daevox" timestamp="12:34">
        {"```\nplain text\n```"}
      </Message>,
    );

    expect(unlabeled.querySelector(`.${styles.codeLanguage}`)).toBeNull();
    vi.unstubAllGlobals();
  });

  test("renders generation metrics", async () => {
    const container = await render(
      <Message
        author="Daevox"
        timestamp="12:34"
        metrics={{
          completionTokens: 120,
          durationMs: 4000,
          tokensPerSecond: 30,
          estimated: false,
        }}
      >
        The response
      </Message>,
    );

    expect(
      container.querySelector('[aria-label="Generation metrics"]')?.textContent,
    ).toContain("120 tokens · 30.0 tok/s");
  });

  test("does not render raw HTML from string messages", async () => {
    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        {'<script>alert("unsafe")</script>\n**Safe**'}
      </Message>,
    );
    const body = container.querySelector(`.${styles.body}`);

    expect(body?.querySelector("script")).toBeNull();
    expect(body?.querySelector("strong")?.textContent).toBe("Safe");
  });

  test("renders active and completed thinking inside the message", async () => {
    const active = await render(
      <Message
        author="Daevox"
        timestamp="12:34"
        thinking={{ content: "Analyzing the request" }}
      >
        The response
      </Message>,
    );
    const activeArticle = active.querySelector("article");
    const activeThinking = activeArticle?.querySelector("details");

    expect(activeThinking?.open).toBe(true);
    expect(activeThinking?.textContent).toContain("Analyzing the request");
    expect(activeArticle?.querySelector(`.${styles.body!}`)?.textContent).toBe(
      "The response",
    );

    const complete = await render(
      <Message
        author="Daevox"
        timestamp="12:34"
        thinking={{ content: "Finished reasoning", isComplete: true }}
      >
        The response
      </Message>,
    );

    expect(
      complete.querySelector<HTMLDetailsElement>("article details")?.open,
    ).toBe(false);

    const empty = await render(
      <Message author="Daevox" timestamp="12:34" thinking={{ content: "" }}>
        The response
      </Message>,
    );

    expect(empty.querySelector("details")?.textContent).toContain(
      "Daevox is thinking…",
    );
  });

  test("renders completed sources as a collapsed block with site links", async () => {
    const container = await render(
      <Message
        author="Daevox"
        timestamp="12:34"
        sources={[
          {
            sourceId: "https://example.com/article",
            title: "Example article",
            url: "https://example.com/article",
            domain: "example.com",
          },
        ]}
        sourcesComplete
      >
        The response
      </Message>,
    );
    const sources = container.querySelector<HTMLDetailsElement>(
      `.${sourcesStyles.root}`,
    );
    const link = sources?.querySelector<HTMLAnchorElement>("a");

    expect(sources?.open).toBe(false);
    expect(sources?.querySelector(`.${sourcesStyles.count}`)?.textContent).toBe(
      "1",
    );
    expect(link?.href).toBe("https://example.com/article");
    expect(link?.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/favicon.ico",
    );
  });

  test("scrolls active thinking content to the newest chunk", async () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight",
    );
    const originalScrollTop = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollTop",
    );
    let scrollTop = 0;
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 480,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });

    try {
      const container = await render(
        <Message
          author="Daevox"
          timestamp="12:34"
          thinking={{ content: "A long reasoning stream" }}
        >
          The response
        </Message>,
      );

      expect(
        container.querySelector<HTMLParagraphElement>(
          `.${thinkingStyles.content}`,
        )?.scrollTop,
      ).toBe(480);
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollHeight",
          originalScrollHeight,
        );
      } else {
        delete (HTMLElement.prototype as { scrollHeight?: number })
          .scrollHeight;
      }
      if (originalScrollTop) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollTop",
          originalScrollTop,
        );
      } else {
        delete (HTMLElement.prototype as { scrollTop?: number }).scrollTop;
      }
    }
  });

  test("calls the supplied copy handler", async () => {
    const onCopy = vi.fn();
    const container = await render(
      <Message author="Daevox" timestamp="12:34" onCopy={onCopy}>
        Copy me
      </Message>,
    );

    container.querySelector<HTMLButtonElement>("button")?.click();

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  test("copies string content with the clipboard fallback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        Copy me
      </Message>,
    );

    container.querySelector<HTMLButtonElement>("button")?.click();

    expect(writeText).toHaveBeenCalledWith("Copy me");
    vi.unstubAllGlobals();
  });

  test("does not use the clipboard fallback for non-string content", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const container = await render(
      <Message author="Daevox" timestamp="12:34">
        <strong>Copy me</strong>
      </Message>,
    );

    container.querySelector<HTMLButtonElement>("button")?.click();

    expect(writeText).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
