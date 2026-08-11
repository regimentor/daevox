import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import { fn } from "storybook/test";
import { Message } from "./message.js";

type MessageStoryArgs = ComponentProps<typeof Message>;

const renderWithOutgoing = (args: MessageStoryArgs) => (
  <div style={{ display: "grid", gap: "0.75rem" }}>
    <Message {...args} alignment="left" />
    <Message {...args} alignment="right" author="You" />
  </div>
);

const meta = {
  title: "Units/Message",
  component: Message,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    author: "Daevox",
    timestamp: "12:34",
    children: "The deployment completed successfully.",
    onCopy: fn(),
  },
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Incoming: Story = {
  render: renderWithOutgoing,
};

export const Outgoing: Story = {
  args: {
    alignment: "right",
    author: "You",
    children: "Great, thank you!",
  },
};

export const LongContent: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children:
      "Here is a longer response to show how the message wraps across multiple lines while keeping the author, copy action, and timestamp aligned with the content.",
  },
};

export const MarkdownLists: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `Я могу помочь с этим:

1.

   **Спецификация — прежде всего.** Сначала определим смысл и структуру.

2.

   **Прямо и по делу.** Без лишних догадок и усложнений.

3.

   **Учёба через практику.** Разберём архитектуру и реализацию на примере.

4.

   **Доверяй, но проверяй.** Проверим решение до внедрения.

- [x] Поддержать списки
- [ ] Сохранить code blocks
  - Включая вложенные пункты`,
  },
};

export const LooseFunctionCallBlocks: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `**Что я вижу:**

1. **Тулзы как слой абстракции**
   ◦ Агент вызывает функции вроде

      search_memory(query)

      ,

      get_context()

      ,

      update_memory()

      .
   ◦ Эти функции обращаются к sqlite-vec (или к прослойке, которая обращается к sqlite-vec).
   ◦ Это хорошо: агент не знает деталей хранения, а система памяти управляет доступом.

2. **Проблема «локальности»**
   ◦ sqlite-vec — это файл в директории vault.
   ◦ Если agent живёт в том же процессе — отлично.
   ◦ Если agent — это отдельный процесс или HTTP-сервис — нужен способ общения.`,
  },
};

export const MarkdownBlocks: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `# Markdown blocks

## Inline formatting

**Bold text**, _italic text_, ~~deleted text~~, and \`inline code\`.

This paragraph contains a hard line break\\
and a second line.

---

### Escaped characters

\*This is not italic\* and \[this is not a link\].`,
  },
};

export const MarkdownNestedLists: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `## Implementation plan

1. Prepare the project
   - Check the current state
   - Confirm the constraints
2. Implement the change
   1. Update the component
   2. Add regression tests
3. Verify the result`,
  },
};

export const MarkdownQuoteAndLinks: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `> A good interface makes the right thing easy to do.
>
> It should also make the wrong thing difficult to do.

Useful references:

- [React Markdown](https://github.com/remarkjs/react-markdown)
- <https://github.com/remarkjs/remark-gfm>
- \`https://example.com\` as inline code`,
  },
};

export const MarkdownTable: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `## Release status

| Component | Status | Notes |
| :--- | :---: | ---: |
| UI | Ready | Markdown renderer updated |
| API | In progress | Waiting for integration |
| Docs | Planned | Add usage examples |`,
  },
};

export const MarkdownCode: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `### TypeScript

\`\`\`typescript
const message = "Markdown is rendered safely";
console.log(message);
\`\`\`

### JSON

\`\`\`json
{
  "status": "ready",
  "items": ["lists", "tables", "code"]
}
\`\`\`

### Unknown language

\`\`\`custom-format
plain text is still displayed safely
\`\`\``,
  },
};

export const MarkdownLinksAndImage: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `A [regular link](https://example.com) and an image:

![Example image](https://placehold.co/320x96/1e2430/d6deeb?text=Markdown+image)

The image has descriptive alt text and the link remains keyboard accessible.`,
  },
};

export const MarkdownMixedResponse: Story = {
  render: renderWithOutgoing,
  args: {
    author: "Assistant",
    children: `# Deployment checklist

The service is ready for review. Here is the current summary:

- [x] Configuration validated
- [x] Database migration applied
- [ ] Production rollout approved

> The next step is a controlled rollout with monitoring enabled.

| Check | Result |
| --- | --- |
| Build | Passed |
| Tests | 11 Markdown tests passed |
| Storybook | Built successfully |

\`\`\`bash
npm run build
npm test
\`\`\`

See the [deployment guide](https://example.com/docs/deployment) for details.`,
  },
};
