import { ipcMain } from "electron";
import {
  AgentStreamEventSchema,
  MessageSchema,
  NextCompletionSchema,
  NextCompletionTransportRequestSchema,
  agentStreamChannel,
  nextCompletionChannel,
} from "@daevox/contracts";
import { getCompletion } from "@daevox/domain";

const registerIpcHandlers = () => {
  ipcMain.handle(nextCompletionChannel, async (event, request: unknown) => {
    const { requestId, ...completionRequest } =
      NextCompletionTransportRequestSchema.parse(request);

    try {
      return await getCompletion(
        NextCompletionSchema.parse(completionRequest),
        {
          onReasoning: (content) =>
            event.sender.send(
              agentStreamChannel,
              AgentStreamEventSchema.parse({
                requestId,
                type: "reasoning",
                content,
              }),
            ),
          onResponse: (content) =>
            event.sender.send(
              agentStreamChannel,
              AgentStreamEventSchema.parse({
                requestId,
                type: "response",
                content,
              }),
            ),
          onTool: (tool) =>
            event.sender.send(
              agentStreamChannel,
              AgentStreamEventSchema.parse({
                requestId,
                type: "tool",
                ...tool,
              }),
            ),
          onSource: (source) =>
            event.sender.send(
              agentStreamChannel,
              AgentStreamEventSchema.parse({
                requestId,
                type: "source",
                ...source,
              }),
            ),
        },
      );
    } catch (error) {
      console.error("[desktop] completion failed", error);

      return MessageSchema.parse({
        actor: "agent",
        type: "completion",
        content:
          "Не удалось получить ответ. Проверьте подключение к модели и повторите запрос.",
        createdAt: new Date(),
      });
    }
  });
};

export { registerIpcHandlers };
