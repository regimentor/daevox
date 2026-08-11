import type {
  AgentStreamListener,
  Api,
  CompletionErrorListener,
  ContextInfo,
  DialogSummary,
  Message,
  NewMessageEvent,
  NewMessageListener,
} from "@daevox/contracts";

class UiApi {
  private static readonly instance = new UiApi();
  private implementation: Api | undefined;
  private readonly streamListeners = new Set<AgentStreamListener>();
  private readonly listeners = new Set<NewMessageListener>();
  private readonly completionErrorListeners =
    new Set<CompletionErrorListener>();

  private constructor() {}

  static getInstance(): UiApi {
    return UiApi.instance;
  }

  setImplementation(implementation: Api): void {
    this.implementation = implementation;

    for (const listener of this.streamListeners) {
      implementation.onAgentStream(listener);
    }

    for (const listener of this.listeners) {
      implementation.onNewMessage(listener);
    }

    for (const listener of this.completionErrorListeners) {
      implementation.onCompletionError?.(listener);
    }
  }

  isConfigured(): boolean {
    return this.implementation !== undefined;
  }

  async listDialogs(): Promise<DialogSummary[]> {
    return this.implementation?.listDialogs() ?? [];
  }

  async createDialog(): Promise<DialogSummary> {
    if (this.implementation) {
      return this.implementation.createDialog();
    }

    throw new Error("Dialog API is unavailable");
  }

  async getDialogMessages(dialogId: string): Promise<Message[]> {
    return this.implementation?.getDialogMessages(dialogId) ?? [];
  }

  async deleteDialog(dialogId: string): Promise<void> {
    if (this.implementation) {
      await this.implementation.deleteDialog(dialogId);
    }
  }

  async getContextInfo(): Promise<ContextInfo> {
    if (this.implementation) {
      return this.implementation.getContextInfo();
    }

    throw new Error("Context API is unavailable");
  }

  async addMessage(dialogId: string, message: Message): Promise<void> {
    if (this.implementation) {
      await this.implementation.addMessage(dialogId, message);
      return;
    }

    // This keeps the UI usable in isolation (for example in Storybook). The
    // client replaces this fallback through setImplementation before startup.
    this.notifyListeners({ dialogId, message });
  }

  onAgentStream(listener: AgentStreamListener): void {
    this.streamListeners.add(listener);

    if (this.implementation) {
      this.implementation.onAgentStream(listener);
    }
  }

  onNewMessage(listener: NewMessageListener): void {
    this.listeners.add(listener);

    if (this.implementation) {
      this.implementation.onNewMessage(listener);
    }
  }

  onCompletionError(listener: CompletionErrorListener): void {
    this.completionErrorListeners.add(listener);

    if (this.implementation) {
      this.implementation.onCompletionError?.(listener);
    }
  }

  private notifyListeners(event: NewMessageEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

const uiApi = UiApi.getInstance();

export { UiApi, uiApi };
