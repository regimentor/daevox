import {
  MemoryGroomer,
  type MemoryClientLike,
} from "@daevox/memory-groomer";
import { DialogsMessagesRepository, DialogsRepository } from "@daevox/storage";
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Mutex } from "async-mutex";
import { toMessage } from "./completion-service.js";
import { onCreateNewDialog } from "./events.js";

@Injectable()
class MemoryGroomerService {
  private readonly logger = new Logger(MemoryGroomerService.name);
  private readonly mutex = new Mutex();

  constructor(
    private readonly dialogs: DialogsRepository,
    private readonly messages: DialogsMessagesRepository,
    private readonly groomer: MemoryGroomer,
  ) {}

  @OnEvent(onCreateNewDialog)
  async onCreateNewDialog(
    _event: Record<string, never> = {},
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.logger.debug(`Start dialog grooming session`)
      const dialog = await this.dialogs.findLatestUngroomedWithMessages();
      if (!dialog) {
        return;
      }

      this.logger.debug(`Grooming dialog ${dialog.id}`);

      try {
        const storedMessages = await this.messages.findByDialogId(dialog.id);
        if (storedMessages.length === 0) {
          return;
        }

        const result = await this.groomer.groom(storedMessages.map(toMessage));
        this.logger.debug(
          `Grooming result: ${JSON.stringify({
            response: result.response,
            toolCalls: result.toolCalls.map(({ name, status }) => ({ name, status })),
          })}`,
        );

        await this.dialogs.markMemoryGroomed(dialog.id);
      } catch (error) {
        this.logger.error(
          `Memory grooming failed for dialog ${dialog.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });
  }
}

export { MemoryGroomerService };
export type { MemoryClientLike };
