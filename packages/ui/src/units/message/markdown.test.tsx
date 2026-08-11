import { describe, expect, test } from "vitest";
import { normalizeMarkdownSource } from "./markdown.js";

describe("normalizeMarkdownSource", () => {
  test("normalizes BOM, line endings, Unicode separators, and blank lines", () => {
    expect(
      normalizeMarkdownSource("\uFEFFFirst\r\n\r\n\r\nSecond\u2028Third"),
    ).toBe("First\n\nSecond\nThird");
  });

  test("keeps Markdown hard breaks and removes insignificant trailing spaces", () => {
    expect(normalizeMarkdownSource("One \nTwo  \nThree   ")).toBe(
      "One\nTwo  \nThree  ",
    );
  });

  test("normalizes whitespace-only lines to blank lines", () => {
    expect(normalizeMarkdownSource("First\n   \n\t\nSecond")).toBe(
      "First\n\nSecond",
    );
  });

  test("joins loose ordered and unordered list continuations", () => {
    expect(
      normalizeMarkdownSource(
        "1.\n\n   **First item**\n\n2.\nSecond item\n\n-\n  Third item",
      ),
    ).toBe("1. **First item**\n\n2. Second item\n\n- Third item");
  });

  test("joins loose function-call blocks into the surrounding paragraph", () => {
    const source = [
      "1. **Тулзы как слой абстракции**",
      "   ◦ Агент вызывает функции вроде",
      "",
      "      search_memory(query)",
      "",
      "      ,",
      "",
      "      get_context()",
      "",
      "      ,",
      "",
      "      update_memory()",
      "",
      "      .",
      "   ◦ Эти функции обращаются к sqlite-vec",
    ].join("\n");

    expect(normalizeMarkdownSource(source)).toBe(
      "1. **Тулзы как слой абстракции**\n" +
        "   ◦ Агент вызывает функции вроде search_memory(query), get_context(), update_memory().\n" +
        "   ◦ Эти функции обращаются к sqlite-vec",
    );
  });

  test("preserves valid nested lists and task list markers", () => {
    const source = "- [x] Done\n  - Nested\n- [ ] Todo";

    expect(normalizeMarkdownSource(source)).toBe(source);
  });

  test("normalizes unambiguous heading and blockquote spacing", () => {
    expect(normalizeMarkdownSource("#   Title\n>quoted")).toBe(
      "# Title\n> quoted",
    );
    expect(normalizeMarkdownSource("#Title")).toBe("#Title");
  });

  test("normalizes unambiguous thematic breaks", () => {
    expect(normalizeMarkdownSource(" * * *\n- - -\n_ _ _")).toBe(
      " ***\n---\n___",
    );
  });

  test("normalizes unambiguous GFM table cell spacing", () => {
    expect(
      normalizeMarkdownSource(
        "|  Name  | Status  |\n| :--- | ---: |\n|  API | Ready  |",
      ),
    ).toBe("| Name | Status |\n| :--- | ---: |\n| API | Ready |");
  });

  test("does not change fenced or indented code", () => {
    const source = [
      "~~~markdown",
      "search_memory(query)",
      "",
      ",",
      "   **Not a list**   ",
      "~~~",
      "",
      "    search_memory(query)",
      "",
      "    ,",
      "    **Not a list**   ",
    ].join("\n");

    expect(normalizeMarkdownSource(source)).toBe(source);
  });

  test("does not change multiline inline code or HTML comments", () => {
    const source = [
      "``",
      "1.",
      "**Not a list**",
      "``",
      "",
      "<!--",
      "1.",
      "**Not a list**",
      "-->",
      "",
      "1.",
      "**A list item**",
    ].join("\n");

    expect(normalizeMarkdownSource(source)).toContain(
      "<!--\n1.\n**Not a list**\n-->",
    );
    expect(normalizeMarkdownSource(source)).toContain("1. **A list item**");
  });

  test("keeps inline Markdown content and raw HTML unchanged", () => {
    const source =
      "**bold** _emphasis_ ~~deleted~~ `inline` \\*literal\\* [link](https://example.com) ![image](https://example.com/image.png) <https://example.com> <script>alert(1)</script>";

    expect(normalizeMarkdownSource(source)).toBe(source);
  });
});
