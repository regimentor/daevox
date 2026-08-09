import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
import {
  createPrismaClient,
  DialogsMessagesRepository,
  DialogsRepository,
} from "@daevox/storage";
import { registerIpcHandlers } from "./register-ipc-handlers.js";

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
  .then(async () => {
    const client = createPrismaClient();
    const dialogs = new DialogsRepository(client);
    await dialogs.create();

    registerIpcHandlers({
      dialogs,
      messages: new DialogsMessagesRepository(client),
    });
    createWindow();

    app.on("before-quit", () => {
      void client.$disconnect();
    });
  })
  .catch((error) => {
    console.error("[desktop] storage initialization failed", error);
    app.quit();
  });
