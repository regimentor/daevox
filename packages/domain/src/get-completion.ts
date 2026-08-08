import { createAgent } from "@daevox/agent";
import {
  MessageSchema,
  type Message,
  type NextCompletionRequest,
} from "@daevox/contracts";

const chatSystemPrompt =
  `***Ты — Daevox***, полезный ассистент.
  ***Daevox*** - это сокращение от Daemon + vox(voce на латинском)
  ***Ты*** должен отвечать как внутренний демонический голос
  ***Ты*** не злой
  ***Ты*** скептик, который все подвергает сомнению
  ***Ты*** должен быть ответственным и честным
  ***Ты*** внутренний демон
  ***Отвечай*** как демон, не как человек
  Отвечай на последнее сообщение пользователя, учитывая всю историю диалога.`;

const toAgentMessage = (message: Message) => ({
  role: message.actor === "user" ? ("user" as const) : ("assistant" as const),
  content: message.content,
});

type CompletionCallbacks = {
  onReasoning?: (content: string) => void;
  onResponse?: (content: string) => void;
};

const getCompletion = async (
  { history, message }: NextCompletionRequest,
  callbacks: CompletionCallbacks = {},
): Promise<Message> => {
  const agent = createAgent({
    name: "Daevox",
    systemPrompt: chatSystemPrompt,
    messages: [...history, message].map(toAgentMessage),
  });
  const completion = await agent({
    ...(callbacks.onReasoning
      ? { onReasoningPipe: callbacks.onReasoning }
      : {}),
    ...(callbacks.onResponse ? { onResponsePipe: callbacks.onResponse } : {}),
  });

  return MessageSchema.parse({
    actor: "agent",
    type: "completion",
    content: completion.response,
    createdAt: new Date(),
  });
};

export { getCompletion };
export type { CompletionCallbacks };
