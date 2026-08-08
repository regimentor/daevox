import { fork } from "effector";
import { Provider } from "effector-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { $messages, type ChatMessage } from "../chat.store.js";
import { Chat } from "./chat.js";

const history: ChatMessage[] = [
  {
    actor: "user",
    type: "completion",
    content: "Can you summarize the latest deployment?",
    createdAt: new Date("2026-08-08T10:30:00.000Z"),
  },
  {
    actor: "agent",
    type: "completion",
    content:
      "The deployment completed successfully. All services are healthy and the new version is receiving traffic.",
    createdAt: new Date("2026-08-08T10:30:04.000Z"),
  },
  {
    actor: "user",
    type: "completion",
    content: "Great, keep an eye on the error rate for the next few minutes.",
    createdAt: new Date("2026-08-08T10:30:20.000Z"),
  },
];

const meta = {
  title: "Features/Chat",
  component: Chat,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Chat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const History: Story = {
  render: () => {
    const scope = fork({ values: [[$messages, history]] });

    return (
      <Provider value={scope}>
        <Chat />
      </Provider>
    );
  },
};
