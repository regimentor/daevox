import {
  type AgentStreamListener,
  nextCompletionChannel,
  type Message,
  type NextCompletionTransportRequest,
} from "@daevox/contracts";

type DaevoxBridge = {
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
