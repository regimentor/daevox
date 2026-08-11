import { ipcMain } from "electron";
import {
  createDialogChannel,
  deleteDialogChannel,
  getContextInfoChannel,
  getDialogMessagesChannel,
  listDialogsChannel,
  nextCompletionChannel,
  NextCompletionTransportRequestSchema,
} from "@daevox/contracts";
import type { OrchestratorClient } from "./orchestrator-client.js";

const registerTransportHandlers = (client: OrchestratorClient): void => {
  ipcMain.handle(listDialogsChannel, () => client.listDialogs());
  ipcMain.handle(createDialogChannel, () => client.createDialog());
  ipcMain.handle(getDialogMessagesChannel, (_event, dialogId: unknown) => {
    if (typeof dialogId !== "string") throw new Error("Invalid dialog id");
    return client.getDialogMessages(dialogId);
  });
  ipcMain.handle(deleteDialogChannel, (_event, dialogId: unknown) => {
    if (typeof dialogId !== "string") throw new Error("Invalid dialog id");
    return client.deleteDialog(dialogId);
  });
  ipcMain.handle(getContextInfoChannel, () => client.getContextInfo());
  ipcMain.handle(nextCompletionChannel, (_event, request: unknown) =>
    client.addMessage(NextCompletionTransportRequestSchema.parse(request)),
  );
};

export { registerTransportHandlers };
