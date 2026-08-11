import { contextBridge, ipcRenderer } from "electron";
import {
  AgentStreamEventSchema,
  agentStreamChannel,
  createDialogChannel,
  deleteDialogChannel,
  getDialogMessagesChannel,
  type AgentStreamListener,
  MessageCreatedEventSchema,
  type MessageCreatedEvent,
  listDialogsChannel,
  nextCompletionChannel,
  type NextCompletionTransportRequest,
  type Message,
} from "@daevox/contracts";

const messageCreatedChannel = "message-created";

contextBridge.exposeInMainWorld("daevox", {
  listDialogs: (): Promise<unknown> => ipcRenderer.invoke(listDialogsChannel),
  createDialog: (): Promise<unknown> => ipcRenderer.invoke(createDialogChannel),
  getDialogMessages: (dialogId: string): Promise<unknown> =>
    ipcRenderer.invoke(getDialogMessagesChannel, dialogId),
  deleteDialog: (dialogId: string): Promise<void> =>
    ipcRenderer.invoke(deleteDialogChannel, dialogId) as Promise<void>,
  addMessage: (request: NextCompletionTransportRequest): Promise<Message> =>
    ipcRenderer.invoke(nextCompletionChannel, request) as Promise<Message>,
  onAgentStream: (listener: AgentStreamListener): void => {
    ipcRenderer.on(agentStreamChannel, (_event, event: unknown) => {
      listener(AgentStreamEventSchema.parse(event));
    });
  },
  onNewMessage: (listener: (event: MessageCreatedEvent) => void): void => {
    ipcRenderer.on(messageCreatedChannel, (_event, event: unknown) => {
      listener(MessageCreatedEventSchema.parse(event));
    });
  },
});
