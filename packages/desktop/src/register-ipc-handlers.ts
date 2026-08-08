import { ipcMain } from "electron";
import {
  AgentStreamEventSchema,
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

    return getCompletion(NextCompletionSchema.parse(completionRequest), {
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
    });
  });
};

export { registerIpcHandlers };
