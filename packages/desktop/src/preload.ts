import { contextBridge, ipcRenderer } from "electron";
import {
  AgentStreamEventSchema,
  agentStreamChannel,
  type AgentStreamListener,
  nextCompletionChannel,
  type NextCompletionTransportRequest,
  type Message,
} from "@daevox/contracts";

contextBridge.exposeInMainWorld("daevox", {
  addMessage: (request: NextCompletionTransportRequest): Promise<Message> =>
    ipcRenderer.invoke(nextCompletionChannel, request) as Promise<Message>,
  onAgentStream: (listener: AgentStreamListener): void => {
    ipcRenderer.on(agentStreamChannel, (_event, event: unknown) => {
      listener(AgentStreamEventSchema.parse(event));
    });
  },
});
