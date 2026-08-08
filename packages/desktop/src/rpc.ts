import {
  nextCompletionChannel,
  type Message,
  type NextCompletionRequest,
} from "@daevox/contracts";

type DaevoxBridge = {
  addMessage(request: NextCompletionRequest): Promise<Message>;
};

declare global {
  interface Window {
    daevox?: DaevoxBridge;
  }
}

export { nextCompletionChannel };
export type { DaevoxBridge };
