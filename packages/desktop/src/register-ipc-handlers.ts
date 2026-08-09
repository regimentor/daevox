import { ipcMain } from "electron";
import {
  AgentStreamEventSchema,
  DialogSummarySchema,
  MessageSchema,
  NextCompletionTransportRequestSchema,
  agentStreamChannel,
  createDialogChannel,
  deleteDialogChannel,
  getDialogMessagesChannel,
  listDialogsChannel,
  nextCompletionChannel,
} from "@daevox/contracts";
import type { DialogsRepository } from "@daevox/storage";
import {
  CompletionService,
  type DialogMessagesStore,
} from "./completion-service.js";

type RegisterIpcHandlersOptions = {
  dialogs: Pick<
    DialogsRepository,
    "create" | "findById" | "findMany" | "delete"
  >;
  messages: DialogMessagesStore;
};

const registerIpcHandlers = ({
  dialogs,
  messages,
}: RegisterIpcHandlersOptions) => {
  const completionServices = new Map<string, CompletionService>();
  const getCompletionService = (dialogId: string) => {
    const existingService = completionServices.get(dialogId);
    if (existingService) {
      return existingService;
    }

    const service = new CompletionService(dialogId, messages);
    completionServices.set(dialogId, service);
    return service;
  };

  ipcMain.handle(listDialogsChannel, async () =>
    (await dialogs.findMany()).map((dialog) =>
      DialogSummarySchema.parse(dialog),
    ),
  );

  ipcMain.handle(createDialogChannel, async () =>
    DialogSummarySchema.parse(await dialogs.create()),
  );

  ipcMain.handle(
    getDialogMessagesChannel,
    async (_event, dialogId: unknown) => {
      if (typeof dialogId !== "string") {
        throw new Error("Invalid dialog id");
      }

      const dialog = await dialogs.findById(dialogId);
      if (!dialog) {
        throw new Error(`Dialog not found: ${dialogId}`);
      }

      const records = await messages.findByDialogId(dialogId);
      return records.map((record) =>
        MessageSchema.parse({
          actor: record.actor,
          type: record.type,
          content: record.content,
          createdAt: record.createdAt,
          ...(record.tools === null ? {} : { tools: record.tools }),
          ...(record.sources === null ? {} : { sources: record.sources }),
          ...(record.metrics === null ? {} : { metrics: record.metrics }),
        }),
      );
    },
  );

  ipcMain.handle(deleteDialogChannel, async (_event, dialogId: unknown) => {
    if (typeof dialogId !== "string") {
      throw new Error("Invalid dialog id");
    }

    await dialogs.delete(dialogId);
    completionServices.delete(dialogId);
  });

  ipcMain.handle(nextCompletionChannel, async (event, request: unknown) => {
    const { dialogId, requestId, message } =
      NextCompletionTransportRequestSchema.parse(request);
    const dialog = await dialogs.findById(dialogId);
    if (!dialog) {
      throw new Error(`Dialog not found: ${dialogId}`);
    }

    return getCompletionService(dialogId).addMessage(message, {
      onReasoning: (content) =>
        event.sender.send(
          agentStreamChannel,
          AgentStreamEventSchema.parse({
            dialogId,
            requestId,
            type: "reasoning",
            content,
          }),
        ),
      onResponse: (content) =>
        event.sender.send(
          agentStreamChannel,
          AgentStreamEventSchema.parse({
            dialogId,
            requestId,
            type: "response",
            content,
          }),
        ),
      onTool: (tool) =>
        event.sender.send(
          agentStreamChannel,
          AgentStreamEventSchema.parse({
            dialogId,
            requestId,
            type: "tool",
            ...tool,
          }),
        ),
      onSource: (source) =>
        event.sender.send(
          agentStreamChannel,
          AgentStreamEventSchema.parse({
            dialogId,
            requestId,
            type: "source",
            ...source,
          }),
        ),
    });
  });
};

export { registerIpcHandlers };
export type { RegisterIpcHandlersOptions };
