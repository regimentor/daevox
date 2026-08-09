import type { Message } from "@daevox/contracts";
import type { PrismaClient } from "./generated/prisma/client.js";
import { Prisma } from "./generated/prisma/client.js";

type CreateDialogsMessageInput = {
  dialogId: string;
  message: Message;
};

class DialogsMessagesRepository {
  constructor(private readonly client: PrismaClient) {}

  create({ dialogId, message }: CreateDialogsMessageInput) {
    return this.client.dialogsMessages.create({
      data: {
        dialogId,
        actor: message.actor,
        type: message.type,
        content: message.content,
        createdAt: message.createdAt,
        ...(message.tools === undefined
          ? {}
          : { tools: message.tools as Prisma.InputJsonValue }),
        ...(message.sources === undefined
          ? {}
          : { sources: message.sources as Prisma.InputJsonValue }),
        ...(message.metrics === undefined
          ? {}
          : { metrics: message.metrics as Prisma.InputJsonValue }),
      },
    });
  }

  findById(id: string) {
    return this.client.dialogsMessages.findUnique({
      where: { id },
    });
  }

  findByDialogId(dialogId: string) {
    return this.client.dialogsMessages.findMany({
      where: { dialogId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  delete(id: string) {
    return this.client.dialogsMessages.delete({
      where: { id },
    });
  }

  deleteByDialogId(dialogId: string) {
    return this.client.dialogsMessages.deleteMany({
      where: { dialogId },
    });
  }
}

export { DialogsMessagesRepository };
export type { CreateDialogsMessageInput };
