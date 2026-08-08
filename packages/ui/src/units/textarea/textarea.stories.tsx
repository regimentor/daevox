import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./textarea.js";

const meta = {
  title: "Units/Textarea",
  component: Textarea,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    label: "Message",
    placeholder: "Write a message...",
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    helperText: "Markdown is supported.",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "A pre-filled message",
  },
};

export const Error: Story = {
  args: {
    error: "Please enter a message.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    helperText: "This field is currently unavailable.",
  },
};

export const WithoutLabel: Story = {
  render: ({ label: _label, ...props }) => (
    <Textarea {...props} aria-label="Message" />
  ),
};
