import { getCompletion, type CompletionCallbacks } from "@daevox/domain";
import {
  type DialogMessagesStore,
  MessageSchema,
  type Message,
  type NextCompletionRequest,
  type StoredMessage,
} from "@daevox/contracts";
import { Mutex } from "async-mutex";

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
  });

const fallbackMessage = (): Message =>
  MessageSchema.parse({
    actor: "agent",
    type: "completion",
    content:
      "Не удалось получить ответ. Проверьте подключение к модели и повторите запрос.",
    createdAt: new Date(),
  });

class CompletionService {
  private readonly mutex = new Mutex();
  private readonly complete: CompletionFunction;

  constructor(
    private readonly dialogId: string,
    private readonly messages: DialogMessagesStore,
    complete?: CompletionFunction,
  ) {
    this.complete = complete ?? getCompletion;
  }

  addMessage(
    message: Message,
    callbacks: CompletionCallbacks = {},
  ): Promise<Message> {
    return this.mutex.runExclusive(async () => {
      const userMessage = MessageSchema.parse(message);
      const createdMessage = await this.messages.create({
        dialogId: this.dialogId,
        message: userMessage,
      });
      const storedMessages = await this.messages.findByDialogId(this.dialogId);
      const history = storedMessages
        .filter((storedMessage) => storedMessage.id !== createdMessage.id)
        .map(toMessage);

      let response: Message;
      try {
        response = await this.complete(
          { history, message: userMessage },
          callbacks,
        );
      } catch (error) {
        console.error("[desktop] completion failed", error);
        response = fallbackMessage();
      }

      await this.messages.create({
        dialogId: this.dialogId,
        message: response,
      });

      return response;
    });
  }
}

export { CompletionService };
export type {
  CompletionFunction,
  DialogMessagesStore,
  StoredMessage,
};
