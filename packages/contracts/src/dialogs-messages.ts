import type { Message } from "./message.js";

type CreateDialogsMessageInput = {
  dialogId: string;
  message: Message;
};

type StoredMessage = {
  id: string;
  actor: string;
  type: string;
  content: string;
  createdAt: Date;
  tools: unknown;
  sources: unknown;
  metrics: unknown;
  memory: unknown;
};

type DialogMessagesStore = {
  create(input: CreateDialogsMessageInput): Promise<StoredMessage>;
  findByDialogId(dialogId: string): Promise<StoredMessage[]>;
};

export type {
  CreateDialogsMessageInput,
  DialogMessagesStore,
  StoredMessage,
};
