import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import {
  completionErrorChannel,
  messageCreatedChannel,
} from "./transport-channels.js";
import { OrchestratorClient } from "./orchestrator-client.js";
import { registerTransportHandlers } from "./register-transport-handlers.js";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  const indexPath = fileURLToPath(
    new URL("./renderer/index.html", import.meta.url),
  );

  win.loadFile(indexPath);
};

app
  .whenReady()
  .then(() => {
    const client = new OrchestratorClient();
    registerTransportHandlers(client);
    client.onAgentStream((event) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("agent-stream", event);
      }
    });
    client.onMessageCreated((event) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(messageCreatedChannel, event);
      }
    });
    client.onCompletionError((event) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(completionErrorChannel, event);
      }
    });
    client.connect();
    createWindow();

    app.on("before-quit", () => {
      client.stop();
    });
  })
  .catch((error) => {
    console.error("[desktop] orchestrator initialization failed", error);
    app.quit();
  });
