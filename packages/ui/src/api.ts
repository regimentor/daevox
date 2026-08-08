import type { Api, Message, NewMessageListener } from "@daevox/contracts";

class UiApi {
  private static readonly instance = new UiApi();
  private implementation: Api | undefined;
  private readonly listeners = new Set<NewMessageListener>();

  private constructor() {}

  static getInstance(): UiApi {
    return UiApi.instance;
  }

  setImplementation(implementation: Api): void {
    this.implementation = implementation;

    for (const listener of this.listeners) {
      implementation.onNewMessage(listener);
    }
  }

  isConfigured(): boolean {
    return this.implementation !== undefined;
  }

  async addMessage(message: Message): Promise<void> {
    if (this.implementation) {
      await this.implementation.addMessage(message);
      return;
    }

    // This keeps the UI usable in isolation (for example in Storybook). The
    // client replaces this fallback through setImplementation before startup.
    this.notifyListeners(message);
  }

  onNewMessage(listener: NewMessageListener): void {
    this.listeners.add(listener);

    if (this.implementation) {
      this.implementation.onNewMessage(listener);
    }
  }

  private notifyListeners(message: Message): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

const uiApi = UiApi.getInstance();

export { UiApi, uiApi };
