import type { PrismaClient } from "./generated/prisma/client.js";

type CreateDialogInput = {
  id?: string;
  createdAt?: Date;
};

class DialogsRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: CreateDialogInput = {}) {
    return this.client.dialogs.create({
      data: input,
    });
  }

  findById(id: string) {
    return this.client.dialogs.findUnique({
      where: { id },
    });
  }

  findMany() {
    return this.client.dialogs.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  findLatestUngroomedWithMessages() {
    return this.client.dialogs.findFirst({
      where: {
        memoryGroomed: false,
        messages: { some: {} },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  markMemoryGroomed(id: string) {
    return this.client.dialogs.update({
      where: { id },
      data: { memoryGroomed: true },
    });
  }

  delete(id: string) {
    return this.client.dialogs.delete({
      where: { id },
    });
  }
}

export { DialogsRepository };
export type { CreateDialogInput };
