import {
  AgentStreamEventSchema,
  CompletionErrorEventSchema,
  MessageCreatedEventSchema,
  OrchestratorEventSchema,
  type AgentStreamEvent,
  type CompletionErrorEvent,
  type MessageCreatedEvent,
  type OrchestratorEvent,
} from "@daevox/contracts";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "ws";

const internalAgentStreamEvent = "orchestrator.agent.stream";
const internalMessageCreatedEvent = "orchestrator.message.created";
const internalCompletionErrorEvent = "orchestrator.completion.error";
const onCreateNewDialog = "onCreateNewDialog";

type InternalAgentStreamEvent = AgentStreamEvent;
type InternalMessageCreatedEvent = MessageCreatedEvent;
type InternalCompletionErrorEvent = CompletionErrorEvent;

@WebSocketGateway({ path: "/events" })
class EventsGateway {
  @WebSocketServer()
  private server!: Server;

  publish(event: OrchestratorEvent): void {
    const payload = JSON.stringify(OrchestratorEventSchema.parse(event));
    for (const client of this.server?.clients ?? []) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }
}

@Injectable()
class OrchestratorEventHandlers {
  constructor(private readonly gateway: EventsGateway) {}

  @OnEvent(internalAgentStreamEvent)
  onAgentStream(event: InternalAgentStreamEvent): void {
    this.gateway.publish({
      event: "agent.stream",
      data: AgentStreamEventSchema.parse(event),
    });
  }

  @OnEvent(internalMessageCreatedEvent)
  onMessageCreated(event: InternalMessageCreatedEvent): void {
    this.gateway.publish({
      event: "message.created",
      data: MessageCreatedEventSchema.parse(event),
    });
  }

  @OnEvent(internalCompletionErrorEvent)
  onCompletionError(event: InternalCompletionErrorEvent): void {
    this.gateway.publish({
      event: "completion.error",
      data: CompletionErrorEventSchema.parse(event),
    });
  }
}

export {
  EventsGateway,
  OrchestratorEventHandlers,
  internalAgentStreamEvent,
  internalCompletionErrorEvent,
  internalMessageCreatedEvent,
  onCreateNewDialog,
};
export type {
  InternalAgentStreamEvent,
  InternalCompletionErrorEvent,
  InternalMessageCreatedEvent,
};
