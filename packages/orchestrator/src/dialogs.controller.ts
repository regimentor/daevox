import {
  DialogSummarySchema,
  MessageSchema,
  SendMessageRequestSchema,
  type DialogSummary,
  type Message,
  type SendMessageRequest,
} from "@daevox/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DialogsMessagesRepository, DialogsRepository } from "@daevox/storage";
import { CompletionService, toMessage } from "./completion-service.js";
import { onCreateNewDialog } from "./events.js";

const toDialog = (dialog: DialogSummary): DialogSummary => DialogSummarySchema.parse(dialog);

@Controller()
class DialogsController {
  constructor(
    private readonly dialogs: DialogsRepository,
    private readonly messages: DialogsMessagesRepository,
    private readonly completion: CompletionService,
    private readonly events: EventEmitter2,
  ) {}

  @Get("health")
  health(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("api/dialogs")
  async listDialogs(): Promise<DialogSummary[]> {
    return (await this.dialogs.findMany()).map(toDialog);
  }

  @Post("api/dialogs")
  async createDialog(): Promise<DialogSummary> {
    const dialog = await this.dialogs.create();
    this.events.emit(onCreateNewDialog, {});
    return toDialog(dialog);
  }

  @Get("api/dialogs/:dialogId/messages")
  async getMessages(@Param("dialogId") dialogId: string): Promise<Message[]> {
    await this.requireDialog(dialogId);
    return (await this.messages.findByDialogId(dialogId)).map(toMessage);
  }

  @Delete("api/dialogs/:dialogId")
  async deleteDialog(@Param("dialogId") dialogId: string): Promise<void> {
    await this.requireDialog(dialogId);
    await this.dialogs.delete(dialogId);
  }

  @Post("api/dialogs/:dialogId/messages")
  async addMessage(
    @Param("dialogId") dialogId: string,
    @Body() body: unknown,
  ): Promise<Message> {
    await this.requireDialog(dialogId);
    let request: SendMessageRequest;
    try {
      request = SendMessageRequestSchema.parse(body);
    } catch {
      throw new BadRequestException("Invalid message payload");
    }
    return this.completion.addMessage(
      dialogId,
      request.requestId,
      MessageSchema.parse(request.message),
    );
  }

  private async requireDialog(dialogId: string): Promise<void> {
    if (!(await this.dialogs.findById(dialogId))) {
      throw new NotFoundException(`Dialog not found: ${dialogId}`);
    }
  }
}

export { DialogsController };
