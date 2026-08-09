import {
  type AgentStreamListener,
  type DialogSummary,
  nextCompletionChannel,
  type Message,
  type NextCompletionTransportRequest,
} from "@daevox/contracts";

type DaevoxBridge = {
  listDialogs(): Promise<DialogSummary[]>;
  createDialog(): Promise<DialogSummary>;
  getDialogMessages(dialogId: string): Promise<Message[]>;
  deleteDialog(dialogId: string): Promise<void>;
  addMessage(request: NextCompletionTransportRequest): Promise<Message>;
  onAgentStream(listener: AgentStreamListener): void;
};

declare global {
  interface Window {
    daevox?: DaevoxBridge;
  }
}

export { nextCompletionChannel };
export type { DaevoxBridge };
