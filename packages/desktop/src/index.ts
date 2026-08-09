import { app, BrowserWindow, shell } from "electron";
import { fileURLToPath } from "node:url";
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

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
