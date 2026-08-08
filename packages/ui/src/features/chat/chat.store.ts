import {
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
            status: "streaming" as const,
          };

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
  ChatMessage,
  ChatMessageActor,
  ChatMessageType,
  Message,
};
