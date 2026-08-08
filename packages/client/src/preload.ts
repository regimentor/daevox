import { contextBridge, ipcRenderer } from "electron";
import {
  nextCompletionChannel,
  type Message,
  type NextCompletionRequest,
} from "@daevox/contracts";

contextBridge.exposeInMainWorld("daevox", {
  addMessage: (request: NextCompletionRequest): Promise<Message> =>
    ipcRenderer.invoke(nextCompletionChannel, request) as Promise<Message>,
});
