import {
  type AgentStreamListener,
  type CompletionErrorListener,
  type ContextInfo,
  type DialogSummary,
  nextCompletionChannel,
  type Message,
  type MessageCreatedEvent,
  type NextCompletionTransportRequest,
} from "@daevox/contracts";

type DaevoxBridge = {
  listDialogs(): Promise<DialogSummary[]>;
  createDialog(): Promise<DialogSummary>;
  getDialogMessages(dialogId: string): Promise<Message[]>;
  deleteDialog(dialogId: string): Promise<void>;
  getContextInfo(): Promise<ContextInfo>;
  addMessage(request: NextCompletionTransportRequest): Promise<Message>;
  onAgentStream(listener: AgentStreamListener): void;
  onNewMessage?(listener: (event: MessageCreatedEvent) => void): void;
  onCompletionError?(listener: CompletionErrorListener): void;
};

declare global {
  interface Window {
    daevox?: DaevoxBridge;
  }
}

export { nextCompletionChannel };
export type { DaevoxBridge };
