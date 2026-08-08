import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { main } from "./main.js";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  const indexPath = fileURLToPath(
    new URL("./renderer/index.html", import.meta.url),
  );

  win.loadFile(indexPath);
};

app.whenReady().then(() => {
  void main();
  createWindow();
});
