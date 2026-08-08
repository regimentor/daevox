import { createAgent } from "@daevox/agent";
import {
  MessageSchema,
  type Message,
  type NextCompletionRequest,
} from "@daevox/contracts";

const chatSystemPrompt =
  "Ты — Daevox, полезный ассистент. Отвечай на последнее сообщение пользователя, учитывая всю историю диалога.";

const toAgentMessage = (message: Message) => ({
  role: message.actor === "user" ? ("user" as const) : ("assistant" as const),
  content: message.content,
});

const getCompletion = async ({
  history,
  message,
}: NextCompletionRequest): Promise<Message> => {
  const agent = createAgent({
    name: "Daevox",
    systemPrompt: chatSystemPrompt,
    messages: [...history, message].map(toAgentMessage),
  });
  const completion = await agent({});

  return MessageSchema.parse({
    actor: "agent",
    type: "completion",
    content: completion.response,
    createdAt: new Date(),
  });
};

export { getCompletion };
