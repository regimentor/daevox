type FenceState = {
  character: "`" | "~";
  length: number;
};

type MarkdownScanState = {
  fence: FenceState | null;
  htmlComment: boolean;
  htmlTag: string | null;
  indentedCode: boolean;
  inlineCodeLength: number | null;
};

type ListMarker = {
  indent: number;
};

const emptyScanState = (): MarkdownScanState => ({
  fence: null,
  htmlComment: false,
  htmlTag: null,
  indentedCode: false,
  inlineCodeLength: null,
});

const countIndent = (line: string): number => {
  let indent = 0;

  for (const character of line) {
    if (character === " ") {
      indent += 1;
      continue;
    }

    if (character === "\t") {
      indent += 4;
      continue;
    }

    break;
  }

  return indent;
};

const isBlank = (line: string): boolean => line.trim() === "";

const isIndentedCodeLine = (line: string): boolean =>
  !isBlank(line) && (line.startsWith("    ") || line.startsWith("\t"));

const getFence = (line: string): FenceState | null => {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})[^`~]*$/);

  if (!match) {
    return null;
  }

  const marker = match[1];

  if (!marker) {
    return null;
  }

  return {
    character: marker[0] as "`" | "~",
    length: marker.length,
  };
};

const isFenceClose = (line: string, fence: FenceState): boolean => {
  const expression = new RegExp(
    `^ {0,3}${fence.character}{${fence.length},}\\s*$`,
  );

  return expression.test(line);
};

const countUnescapedRun = (
  line: string,
  start: number,
  character: string,
): number => {
  let end = start;

  while (line[end] === character) {
    end += 1;
  }

  return end - start;
};

const isEscaped = (line: string, index: number): boolean => {
  let slashCount = 0;

  for (
    let cursor = index - 1;
    cursor >= 0 && line[cursor] === "\\";
    cursor -= 1
  ) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
};

const updateInlineCodeState = (
  line: string,
  initialLength: number | null,
): number | null => {
  let delimiterLength = initialLength;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "`" || isEscaped(line, index)) {
      continue;
    }

    const runLength = countUnescapedRun(line, index, "`");
    index += runLength - 1;

    if (delimiterLength === null) {
      delimiterLength = runLength;
    } else if (runLength === delimiterLength) {
      delimiterLength = null;
    }
  }

  return delimiterLength;
};

const updateHtmlState = (line: string, state: MarkdownScanState): void => {
  if (state.htmlComment) {
    if (line.includes("-->")) {
      state.htmlComment = false;
    }

    return;
  }

  if (line.includes("<!--") && !line.includes("-->")) {
    state.htmlComment = true;
    return;
  }

  if (state.htmlTag) {
    const closingTag = new RegExp(`</${state.htmlTag}\\s*>`, "i");

    if (closingTag.test(line)) {
      state.htmlTag = null;
    }
  }
};

const getHtmlBlockTag = (line: string): string | null => {
  const match = line.match(/^\s*<([A-Za-z][\w:-]*)(?:\s[^<>]*)?>/);

  if (!match || /\/\s*>\s*$/.test(line)) {
    return null;
  }

  const tag = match[1];

  if (!tag) {
    return null;
  }

  const closingTag = new RegExp(`</${tag}\\s*>`, "i");

  return closingTag.test(line) ? null : tag;
};

const getListMarker = (line: string): ListMarker | null => {
  const match = line.match(/^(\s*)(?:[-+*]|\d{1,9}[.)])[ \t]*$/);

  if (!match) {
    return null;
  }

  const indent = match[1];
  if (indent === undefined) {
    return null;
  }

  return {
    indent: countIndent(indent),
  };
};

const isListLine = (line: string): boolean =>
  /^\s*(?:[-+*]|\d{1,9}[.)])(?:[ \t]+\S|$)/.test(line);

const isBlockBoundary = (line: string): boolean => {
  if (/^\s{0,3}(?:`{3,}|~{3,})/.test(line)) {
    return true;
  }

  if (/^\s{0,3}#{1,6}(?:[ \t]|$)/.test(line)) {
    return true;
  }

  if (/^\s{0,3}>/.test(line)) {
    return true;
  }

  if (isListLine(line)) {
    return true;
  }

  if (/^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) {
    return true;
  }

  return /^\s*<(?:[A-Za-z]|!--)/.test(line);
};

const normalizeTrailingWhitespace = (line: string): string => {
  if (isBlank(line)) {
    return "";
  }

  return line.replace(/ +$/, (spaces) => (spaces.length >= 2 ? "  " : ""));
};

const normalizeHeadingSpacing = (line: string): string =>
  line.replace(/^(\s{0,3}#{1,6})[ \t]+/, "$1 ");

const normalizeBlockquoteSpacing = (line: string): string =>
  line.replace(/^(\s{0,3}>)(?=\S)/, "$1 ");

const normalizeThematicBreak = (line: string): string => {
  const match = line.match(/^(\s{0,3})([*_-])(?:[ \t]*\2){2,}[ \t]*$/);

  if (!match) {
    return line;
  }

  const indent = match[1];
  const marker = match[2];

  if (indent === undefined || marker === undefined) {
    return line;
  }

  return `${indent}${marker.repeat(3)}`;
};

const splitTableCells = (line: string): string[] => {
  const cells: string[] = [];
  let cell = "";
  let escaped = false;

  for (const character of line) {
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      cell += character;
      escaped = true;
      continue;
    }

    if (character === "|") {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += character;
  }

  cells.push(cell);
  return cells;
};

const isTableSeparator = (line: string): boolean => {
  const cells = splitTableCells(line.trim());
  const normalizedCells = cells.filter((cell, index) => {
    const isOuterCell =
      (index === 0 || index === cells.length - 1) && cell.trim() === "";

    return !isOuterCell;
  });

  return (
    normalizedCells.length > 0 &&
    normalizedCells.every((cell) => /^:?-{1,}:?$/.test(cell.trim()))
  );
};

const hasTablePipe = (line: string): boolean =>
  splitTableCells(line).length > 1;

const normalizeTableRow = (line: string): string => {
  const trimmed = line.trim();
  const hasLeadingPipe = trimmed.startsWith("|");
  const hasTrailingPipe = trimmed.endsWith("|");
  const cells = splitTableCells(trimmed).map((cell) => cell.trim());
  const content = cells
    .slice(hasLeadingPipe ? 1 : 0, hasTrailingPipe ? -1 : undefined)
    .join(" | ");

  return `${hasLeadingPipe ? "| " : ""}${content}${
    hasTrailingPipe ? " |" : ""
  }`;
};

const canJoinListContent = (marker: ListMarker, line: string): boolean => {
  if (isBlank(line) || isBlockBoundary(line)) {
    return false;
  }

  return countIndent(line) <= marker.indent + 3;
};

const isStandaloneFunctionCall = (line: string): boolean => {
  const content = line.trim().replace(/^`+|`+$/g, "");

  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\([^\n]*\)[,.;:]?$/.test(
    content,
  );
};

const isStandalonePunctuation = (line: string): boolean =>
  /^[,.;:!?。！？]$/.test(line.trim());

const isListContentLine = (line: string): boolean =>
  isListLine(line) || /^\s*[•◦▪‣]\s+\S/.test(line);

const canAttachFunctionCall = (line: string, functionLine: string): boolean =>
  !isBlank(line) &&
  !/^\s*(?:#{1,6}(?:[ \t]|$)|>|(?:`{3,}|~{3,}))/.test(line) &&
  !(isIndentedCodeLine(line) && !isListContentLine(line)) &&
  (countIndent(functionLine) <= countIndent(line) + 3 ||
    isListContentLine(line));

const joinFunctionCallParts = (parts: string[]): string =>
  parts.join(" ").replace(/\s+([,.;:!?。！？])/g, "$1");

const normalizeLooseFunctionCallBlocks = (lines: string[]): string[] => {
  const output: string[] = [];
  const state = emptyScanState();

  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? "";

    if (state.fence) {
      output.push(line);

      if (isFenceClose(line, state.fence)) {
        state.fence = null;
      }

      index += 1;
      continue;
    }

    if (state.htmlComment || state.htmlTag) {
      output.push(line);
      updateHtmlState(line, state);
      index += 1;
      continue;
    }

    if (state.inlineCodeLength !== null) {
      output.push(line);
      state.inlineCodeLength = updateInlineCodeState(
        line,
        state.inlineCodeLength,
      );
      index += 1;
      continue;
    }

    const fence = getFence(line);

    if (fence) {
      output.push(line);
      state.fence = fence;
      index += 1;
      continue;
    }

    if (line.includes("<!--")) {
      output.push(line);
      updateHtmlState(line, state);
      index += 1;
      continue;
    }

    const htmlTag = getHtmlBlockTag(line);

    if (htmlTag) {
      output.push(line);
      state.htmlTag = htmlTag;
      index += 1;
      continue;
    }

    if (!isStandaloneFunctionCall(line)) {
      output.push(line);
      state.inlineCodeLength = updateInlineCodeState(line, null);
      index += 1;
      continue;
    }

    let previousIndex = output.length - 1;

    while (previousIndex >= 0 && isBlank(output[previousIndex] ?? "")) {
      previousIndex -= 1;
    }

    const previousLine = output[previousIndex] ?? "";

    if (
      previousIndex < 0 ||
      !canAttachFunctionCall(previousLine, line)
    ) {
      output.push(line);
      state.inlineCodeLength = updateInlineCodeState(line, null);
      index += 1;
      continue;
    }

    const parts: string[] = [];
    let cursor = index;

    while (cursor < lines.length) {
      const part = lines[cursor] ?? "";

      if (isBlank(part)) {
        let nextContent = cursor + 1;

        while (nextContent < lines.length && isBlank(lines[nextContent] ?? "")) {
          nextContent += 1;
        }

        const nextLine = lines[nextContent] ?? "";

        if (
          nextContent < lines.length &&
          (isStandaloneFunctionCall(nextLine) ||
            isStandalonePunctuation(nextLine))
        ) {
          cursor = nextContent;
          continue;
        }

        break;
      }

      if (
        !isStandaloneFunctionCall(part) &&
        !isStandalonePunctuation(part)
      ) {
        break;
      }

      parts.push(part.trim());
      cursor += 1;
    }

    const hasFunctionCall = parts.some(isStandaloneFunctionCall);

    if (!hasFunctionCall || parts.length === 0) {
      output.push(line);
      state.inlineCodeLength = updateInlineCodeState(line, null);
      index += 1;
      continue;
    }

    output.splice(previousIndex + 1);
    output[previousIndex] = `${previousLine.trimEnd()} ${joinFunctionCallParts(
      parts,
    )}`;
    index = cursor;
  }

  return output;
};

const appendLine = (
  output: string[],
  line: string,
  preserveBlank: boolean,
  blankLines: { value: number },
): void => {
  if (preserveBlank || !isBlank(line)) {
    output.push(line);
    blankLines.value = 0;
    return;
  }

  if (blankLines.value === 0) {
    output.push("");
  }

  blankLines.value += 1;
};

const normalizeMarkdownSource = (source: string): string => {
  const prepared = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0085\u2028\u2029]/g, "\n");
  const lines = normalizeLooseFunctionCallBlocks(prepared.split("\n"));
  const output: string[] = [];
  const state = emptyScanState();
  const blankLines = { value: 0 };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (state.fence) {
      appendLine(output, line, true, blankLines);

      if (isFenceClose(line, state.fence)) {
        state.fence = null;
      }

      continue;
    }

    if (state.htmlComment || state.htmlTag) {
      appendLine(output, line, true, blankLines);
      updateHtmlState(line, state);
      continue;
    }

    if (state.inlineCodeLength !== null) {
      appendLine(output, line, true, blankLines);
      state.inlineCodeLength = updateInlineCodeState(
        line,
        state.inlineCodeLength,
      );
      continue;
    }

    if (state.indentedCode) {
      if (isBlank(line) || isIndentedCodeLine(line)) {
        appendLine(output, line, true, blankLines);
        continue;
      }

      state.indentedCode = false;
    }

    const fence = getFence(line);

    if (fence) {
      appendLine(output, line, true, blankLines);
      state.fence = fence;
      continue;
    }

    if (isIndentedCodeLine(line) && isBlank(lines[index - 1] ?? "")) {
      appendLine(output, line, true, blankLines);
      state.indentedCode = true;
      continue;
    }

    if (line.includes("<!--")) {
      appendLine(output, line, true, blankLines);
      updateHtmlState(line, state);
      continue;
    }

    const htmlTag = getHtmlBlockTag(line);

    if (htmlTag) {
      appendLine(output, line, true, blankLines);
      state.htmlTag = htmlTag;
      continue;
    }

    const listMarker = getListMarker(line);
    const nextContentIndex = listMarker
      ? (() => {
          let candidate = index + 1;

          while (candidate < lines.length && isBlank(lines[candidate] ?? "")) {
            candidate += 1;
          }

          return candidate;
        })()
      : index;
    const nextContent = lines[nextContentIndex] ?? "";

    if (
      listMarker &&
      nextContentIndex > index &&
      canJoinListContent(listMarker, nextContent)
    ) {
      const joinedLine = `${line.trimEnd()} ${nextContent.trimStart()}`;
      const normalizedJoinedLine = normalizeThematicBreak(
        normalizeBlockquoteSpacing(
          normalizeHeadingSpacing(normalizeTrailingWhitespace(joinedLine)),
        ),
      );

      appendLine(output, normalizedJoinedLine, false, blankLines);
      state.inlineCodeLength = updateInlineCodeState(
        normalizedJoinedLine,
        null,
      );
      updateHtmlState(normalizedJoinedLine, state);
      index = nextContentIndex;
      continue;
    }

    const normalizedLine = normalizeThematicBreak(
      normalizeBlockquoteSpacing(
        normalizeHeadingSpacing(normalizeTrailingWhitespace(line)),
      ),
    );
    const isTable =
      hasTablePipe(normalizedLine) && isTableSeparator(lines[index + 1] ?? "");

    appendLine(
      output,
      isTable ? normalizeTableRow(normalizedLine) : normalizedLine,
      false,
      blankLines,
    );
    state.inlineCodeLength = updateInlineCodeState(normalizedLine, null);
    updateHtmlState(normalizedLine, state);

    if (isTable) {
      let tableIndex = index + 1;

      while (
        tableIndex < lines.length &&
        hasTablePipe(lines[tableIndex] ?? "") &&
        !isBlank(lines[tableIndex] ?? "")
      ) {
        appendLine(
          output,
          normalizeTableRow(
            normalizeTrailingWhitespace(lines[tableIndex] ?? ""),
          ),
          false,
          blankLines,
        );
        tableIndex += 1;
      }

      index = tableIndex - 1;
    }
  }

  while (output[0] === "") {
    output.shift();
  }

  while (output.at(-1) === "") {
    output.pop();
  }

  return output.join("\n");
};

export { normalizeMarkdownSource };
