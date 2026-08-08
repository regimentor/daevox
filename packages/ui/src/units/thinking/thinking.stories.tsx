import type { Meta, StoryObj } from "@storybook/react-vite";
import { Thinking } from "./thinking.js";

const meta = {
  title: "Units/Thinking",
  component: Thinking,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Thinking>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    content: "Checking the available context…",
  },
};

export const Complete: Story = {
  args: {
    content: "Finished reasoning.",
    isComplete: true,
  },
};
