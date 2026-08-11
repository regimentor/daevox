import { contextBridge, ipcRenderer } from "electron";
import {
  AgentStreamEventSchema,
  agentStreamChannel,
  CompletionErrorEventSchema,
  createDialogChannel,
  ContextInfoSchema,
  deleteDialogChannel,
  getContextInfoChannel,
  getDialogMessagesChannel,
  type AgentStreamListener,
  type CompletionErrorEvent,
  MessageCreatedEventSchema,
  type MessageCreatedEvent,
  listDialogsChannel,
  nextCompletionChannel,
  type NextCompletionTransportRequest,
  type Message,
} from "@daevox/contracts";
import {
  completionErrorChannel,
  messageCreatedChannel,
} from "./transport-channels.js";

contextBridge.exposeInMainWorld("daevox", {
  listDialogs: (): Promise<unknown> => ipcRenderer.invoke(listDialogsChannel),
  createDialog: (): Promise<unknown> => ipcRenderer.invoke(createDialogChannel),
  getDialogMessages: (dialogId: string): Promise<unknown> =>
    ipcRenderer.invoke(getDialogMessagesChannel, dialogId),
  getContextInfo: (): Promise<unknown> =>
    ipcRenderer
      .invoke(getContextInfoChannel)
      .then((response: unknown) => ContextInfoSchema.parse(response)),
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
  onCompletionError: (
    listener: (event: CompletionErrorEvent) => void,
  ): void => {
    ipcRenderer.on(completionErrorChannel, (_event, event: unknown) => {
      listener(CompletionErrorEventSchema.parse(event));
    });
  },
});
