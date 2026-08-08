import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Message } from "./message.js";

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

export const Incoming: Story = {};

export const Outgoing: Story = {
  args: {
    alignment: "right",
    author: "You",
    children: "Great, thank you!",
  },
};

export const LongContent: Story = {
  args: {
    author: "Assistant",
    children:
      "Here is a longer response to show how the message wraps across multiple lines while keeping the author, copy action, and timestamp aligned with the content.",
  },
};
