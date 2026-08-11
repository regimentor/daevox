import {
  MessageSchema,
  type AgentSource,
  type AgentMemoryLookup,
  type AgentToolCall,
  type DialogMessagesStore,
  type Message,
  type NextCompletionRequest,
  type StoredMessage,
} from "@daevox/contracts";
import { getCompletion, type CompletionCallbacks } from "@daevox/domain";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Mutex } from "async-mutex";
import {
  internalAgentStreamEvent,
  internalMessageCreatedEvent,
} from "./events.js";
import { dialogMessagesStoreToken, completionFunctionToken } from "./tokens.js";

type CompletionFunction = (
  request: NextCompletionRequest,
  callbacks?: CompletionCallbacks,
) => Promise<Message>;

const toMessage = (record: StoredMessage): Message =>
  MessageSchema.parse({
    actor: record.actor,
    type: record.type,
    content: record.content,
    createdAt: record.createdAt,
    ...(record.tools === null ? {} : { tools: record.tools }),
    ...(record.sources === null ? {} : { sources: record.sources }),
    ...(record.metrics === null ? {} : { metrics: record.metrics }),
    ...(record.memory == null ? {} : { memory: record.memory }),
  });

const fallbackMessage = (memory?: AgentMemoryLookup): Message =>
  MessageSchema.parse({
    actor: "agent",
    type: "completion",
    content:
      "Не удалось получить ответ. Проверьте подключение к модели и повторите запрос.",
    createdAt: new Date(),
    ...(memory ? { memory } : {}),
  });

@Injectable()
class CompletionService {
  private readonly logger = new Logger(CompletionService.name);
  private readonly mutexes = new Map<string, Mutex>();

  constructor(
    @Inject(dialogMessagesStoreToken)
    private readonly messages: DialogMessagesStore,
    @Inject(EventEmitter2)
    private readonly events: EventEmitter2,
    @Optional() @Inject(completionFunctionToken)
    complete?: CompletionFunction,
  ) {
    this.defaultComplete = complete ?? getCompletion;
  }

  private readonly defaultComplete: CompletionFunction;

  async addMessage(
    dialogId: string,
    requestId: string,
    message: Message,
    complete: CompletionFunction = this.defaultComplete,
  ): Promise<Message> {
    const mutex = this.mutexes.get(dialogId) ?? new Mutex();
    this.mutexes.set(dialogId, mutex);

    return mutex.runExclusive(async () => {
      const userMessage = MessageSchema.parse(message);
      const createdMessage = await this.messages.create({
        dialogId,
        message: userMessage,
      });
      this.emitMessage(dialogId, requestId, userMessage);

      const storedMessages = await this.messages.findByDialogId(dialogId);
      const history = storedMessages
        .filter((storedMessage) => storedMessage.id !== createdMessage.id)
        .map(toMessage);

      const callbacks: CompletionCallbacks = {
        onReasoning: (content) =>
          this.emitStream({ dialogId, requestId, type: "reasoning", content }),
        onResponse: (content) =>
          this.emitStream({ dialogId, requestId, type: "response", content }),
        onTool: (tool: AgentToolCall) =>
          this.emitStream({ dialogId, requestId, type: "tool", ...tool }),
        onSource: (source: AgentSource) =>
          this.emitStream({ dialogId, requestId, type: "source", ...source }),
        onMemory: (lookup: AgentMemoryLookup) => {
          memory = lookup;
          this.emitStream({ dialogId, requestId, type: "memory", ...lookup });
        },
      };

      let memory: AgentMemoryLookup | undefined;
      let response: Message;
      try {
        response = await complete(
          { history, message: userMessage },
          callbacks,
        );
        if (memory && response.memory === undefined) {
          response = MessageSchema.parse({ ...response, memory });
        }
      } catch (error) {
        this.logger.error("Completion failed", error);
        response = fallbackMessage(memory);
      }

      await this.messages.create({ dialogId, message: response });
      this.emitMessage(dialogId, requestId, response);
      return response;
    });
  }

  private emitStream(event: AgentStreamEvent): void {
    this.events.emit(internalAgentStreamEvent, event);
  }

  private emitMessage(dialogId: string, requestId: string, message: Message): void {
    this.events.emit(internalMessageCreatedEvent, { dialogId, requestId, message });
  }
}

type AgentStreamEvent =
  | { dialogId: string; requestId: string; type: "reasoning" | "response"; content: string }
  | ({ dialogId: string; requestId: string; type: "tool" } & AgentToolCall)
  | ({ dialogId: string; requestId: string; type: "source" } & AgentSource)
  | ({ dialogId: string; requestId: string; type: "memory" } & AgentMemoryLookup);

export { CompletionService, fallbackMessage, toMessage };
export type { CompletionFunction };
