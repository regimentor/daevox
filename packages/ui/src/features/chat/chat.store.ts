import {
  type AgentSource,
  type AgentToolCall,
  MessageSchema,
  type AgentStreamEvent,
  type Message,
} from "@daevox/contracts";
import { createEvent, createStore } from "effector";
import { uiApi } from "../../api.js";

const addMessage = createEvent<Message>();
const receiveAgentStream = createEvent<AgentStreamEvent>();
const clearAgentStream = createEvent();

type AgentStreamState = {
  requestId: string;
  reasoning: string;
  response: string;
  tools: AgentToolCall[];
  sources: AgentSource[];
  status: "streaming" | "complete";
};

const $messages = createStore<Message[]>([]).on(
  addMessage,
  (messages, message) => [...messages, MessageSchema.parse(message)],
);

const $agentStream = createStore<AgentStreamState | null>(null)
  .on(receiveAgentStream, (state, event) => {
    const nextState =
      state?.requestId === event.requestId
        ? state
        : {
            requestId: event.requestId,
            reasoning: "",
            response: "",
            tools: [],
            sources: [],
            status: "streaming" as const,
          };

    if (event.type === "tool") {
      const tool = {
        toolCallId: event.toolCallId,
        name: event.name,
        input: event.input,
        status: event.status,
        durationMs: event.durationMs,
        error: event.error,
      };
      const toolIndex = nextState.tools.findIndex(
        (existingTool) => existingTool.toolCallId === tool.toolCallId,
      );

      return {
        ...nextState,
        tools:
          toolIndex === -1
            ? [...nextState.tools, tool]
            : nextState.tools.map((existingTool, index) =>
                index === toolIndex ? tool : existingTool,
              ),
      };
    }

    if (event.type === "source") {
      if (
        nextState.sources.some((source) => source.sourceId === event.sourceId)
      ) {
        return nextState;
      }

      return {
        ...nextState,
        sources: [
          ...nextState.sources,
          {
            sourceId: event.sourceId,
            title: event.title,
            url: event.url,
            domain: event.domain,
          },
        ],
      };
    }

    return {
      ...nextState,
      [event.type]: nextState[event.type] + event.content,
    };
  })
  .on(addMessage, (state, message) => {
    if (message.actor === "user") {
      return null;
    }

    return state ? { ...state, response: "", status: "complete" } : state;
  })
  .reset(clearAgentStream);

uiApi.onNewMessage(addMessage);
uiApi.onAgentStream(receiveAgentStream);

type ChatMessage = Message;
type ChatMessageActor = Message["actor"];
type ChatMessageType = Message["type"];

export {
  $agentStream,
  $messages,
  addMessage,
  clearAgentStream,
  receiveAgentStream,
};
export type {
  AgentStreamState,
  AgentToolCall,
  ChatMessage,
  ChatMessageActor,
  ChatMessageType,
  Message,
};
