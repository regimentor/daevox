import { ipcMain } from "electron";
import {
  NextCompletionSchema,
  nextCompletionChannel,
} from "@daevox/contracts";
import { getCompletion } from "@daevox/domain";

const registerIpcHandlers = () => {
  ipcMain.handle(nextCompletionChannel, async (_event, request: unknown) =>
    getCompletion(NextCompletionSchema.parse(request)),
  );
};

export { registerIpcHandlers };
