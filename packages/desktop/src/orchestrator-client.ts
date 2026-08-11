import {
  DialogSummarySchema,
  ContextInfoSchema,
  type CompletionErrorEvent,
  MessageSchema,
  OrchestratorEventSchema,
  type AgentStreamListener,
  type ContextInfo,
  type DialogSummary,
  type Message,
  type MessageCreatedEvent,
  type NextCompletionTransportRequest,
} from "@daevox/contracts";
import WebSocket from "ws";

type OrchestratorClientOptions = {
  baseUrl?: string;
  reconnectDelayMs?: number;
};

type MessageCreatedListener = (event: MessageCreatedEvent) => void;
type CompletionErrorListener = (event: CompletionErrorEvent) => void;

class OrchestratorHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OrchestratorHttpError";
  }
}

class OrchestratorClient {
  private readonly streamListeners = new Set<AgentStreamListener>();
  private readonly messageListeners = new Set<MessageCreatedListener>();
  private readonly completionErrorListeners =
    new Set<CompletionErrorListener>();
  private readonly baseUrl: string;
  private readonly reconnectDelayMs: number;
  private socket: WebSocket | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;

  constructor(options: OrchestratorClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      `http://${process.env.DAEVOX_ORCHESTRATOR_HOST ?? "127.0.0.1"}:${process.env.DAEVOX_ORCHESTRATOR_PORT ?? "8787"}`
    ).replace(/\/$/, "");
    this.reconnectDelayMs = options.reconnectDelayMs ?? 500;
  }

  async listDialogs(): Promise<DialogSummary[]> {
    const response = await this.request("/api/dialogs");
    return ((await response.json()) as unknown[]).map((dialog) =>
      DialogSummarySchema.parse(dialog),
    );
  }

  async createDialog(): Promise<DialogSummary> {
    const response = await this.request("/api/dialogs", { method: "POST" });
    return DialogSummarySchema.parse(await response.json());
  }

  async getDialogMessages(dialogId: string): Promise<Message[]> {
    const response = await this.request(
      `/api/dialogs/${encodeURIComponent(dialogId)}/messages`,
    );
    return ((await response.json()) as unknown[]).map((message) =>
      MessageSchema.parse(message),
    );
  }

  async deleteDialog(dialogId: string): Promise<void> {
    await this.request(`/api/dialogs/${encodeURIComponent(dialogId)}`, {
      method: "DELETE",
    });
  }

  async getContextInfo(): Promise<ContextInfo> {
    const response = await this.request("/api/context");
    return ContextInfoSchema.parse(await response.json());
  }

  async addMessage(request: NextCompletionTransportRequest): Promise<Message> {
    const response = await this.request(
      `/api/dialogs/${encodeURIComponent(request.dialogId)}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: request.requestId,
          message: request.message,
        }),
      },
    );
    return MessageSchema.parse(await response.json());
  }

  connect(): void {
    this.stopped = false;
    this.openSocket();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
  }

  onAgentStream(listener: AgentStreamListener): void {
    this.streamListeners.add(listener);
  }

  onMessageCreated(listener: MessageCreatedListener): void {
    this.messageListeners.add(listener);
  }

  onCompletionError(listener: CompletionErrorListener): void {
    this.completionErrorListeners.add(listener);
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      let message = `Orchestrator request failed (${response.status})`;
      try {
        const body = (await response.json()) as { message?: unknown };
        if (typeof body.message === "string") message = body.message;
      } catch {
        // Keep the status-based error when the server did not return JSON.
      }
      throw new OrchestratorHttpError(response.status, message);
    }
    return response;
  }

  private openSocket(): void {
    if (this.stopped || this.socket) return;

    const url = this.baseUrl.replace(/^http/, "ws") + "/events";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.on("message", (raw) => {
      try {
        const event = OrchestratorEventSchema.parse(JSON.parse(raw.toString()));
        if (event.event === "agent.stream") {
          for (const listener of this.streamListeners) listener(event.data);
        } else if (event.event === "message.created") {
          for (const listener of this.messageListeners) listener(event.data);
        } else {
          for (const listener of this.completionErrorListeners) {
            listener(event.data);
          }
        }
      } catch (error) {
        console.error("[desktop] invalid orchestrator event", error);
      }
    });
    socket.on("close", () => {
      if (this.socket === socket) this.socket = undefined;
      this.scheduleReconnect();
    });
    socket.on("error", () => {
      // close follows error and owns the reconnect path.
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.openSocket();
    }, this.reconnectDelayMs);
  }
}

export { OrchestratorClient, OrchestratorHttpError };
export type {
  CompletionErrorListener,
  MessageCreatedListener,
  OrchestratorClientOptions,
};
