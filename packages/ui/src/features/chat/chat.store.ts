import {
  type AgentSource,
  type AgentMemoryLookup,
  type AgentToolCall,
  MessageSchema,
  type AgentStreamEvent,
  type Message,
  type NewMessageEvent,
} from "@daevox/contracts";
import { createEvent, createStore, sample } from "effector";
import { uiApi } from "../../api.js";

const addMessage = createEvent<Message>();
const replaceMessages = createEvent<Message[]>();
const setActiveDialog = createEvent<string | null>();
const receiveAgentStream = createEvent<AgentStreamEvent>();
const receiveExternalAgentStream = createEvent<AgentStreamEvent>();
const receiveExternalMessage = createEvent<NewMessageEvent>();
const clearAgentStream = createEvent();

type AgentStreamState = {
  requestId: string;
  reasoning: string;
  response: string;
  tools: AgentToolCall[];
  sources: AgentSource[];
  memory?: AgentMemoryLookup;
  status: "streaming" | "complete";
};

const $messages = createStore<Message[]>([])
  .on(addMessage, (messages, message) => [
    ...messages,
    MessageSchema.parse(message),
  ])
  .on(replaceMessages, (_, messages) =>
    messages.map((message) => MessageSchema.parse(message)),
  );

const $activeDialogId = createStore<string | null>(null).on(
  setActiveDialog,
  (_, dialogId) => dialogId,
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

    if (event.type === "memory") {
      return {
        ...nextState,
        memory: {
          status: event.status,
          query: event.query,
          durationMs: event.durationMs,
          resultCount: event.resultCount,
          results: event.results,
          error: event.error,
        },
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

sample({
  source: $activeDialogId,
  clock: receiveExternalMessage,
  filter: (dialogId, event) => dialogId === event.dialogId,
  fn: (_, event) => event.message,
  target: addMessage,
});
sample({
  source: $activeDialogId,
  clock: receiveExternalAgentStream,
  filter: (dialogId, event) => dialogId === event.dialogId,
  fn: (_, event) => event,
  target: receiveAgentStream,
});

uiApi.onNewMessage(receiveExternalMessage);
uiApi.onAgentStream(receiveExternalAgentStream);

type ChatMessage = Message;
type ChatMessageActor = Message["actor"];
type ChatMessageType = Message["type"];

export {
  $agentStream,
  $activeDialogId,
  $messages,
  addMessage,
  clearAgentStream,
  replaceMessages,
  receiveAgentStream,
  setActiveDialog,
};
export type {
  AgentStreamState,
  AgentToolCall,
  ChatMessage,
  ChatMessageActor,
  ChatMessageType,
  Message,
};
