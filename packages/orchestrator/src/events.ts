import {
  AgentStreamEventSchema,
  MessageCreatedEventSchema,
  OrchestratorEventSchema,
  type AgentStreamEvent,
  type MessageCreatedEvent,
  type OrchestratorEvent,
} from "@daevox/contracts";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "ws";

const internalAgentStreamEvent = "orchestrator.agent.stream";
const internalMessageCreatedEvent = "orchestrator.message.created";
const onCreateNewDialog = "onCreateNewDialog";

type InternalAgentStreamEvent = AgentStreamEvent;
type InternalMessageCreatedEvent = MessageCreatedEvent;

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
}

export {
  EventsGateway,
  OrchestratorEventHandlers,
  internalAgentStreamEvent,
  internalMessageCreatedEvent,
  onCreateNewDialog,
};
export type { InternalAgentStreamEvent, InternalMessageCreatedEvent };
