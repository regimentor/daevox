import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { main } from "./main.js";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  const cwd = process.cwd();
  const indexPath = fileURLToPath(new URL(`${cwd}/index.html`, import.meta.url));

  win.loadFile(indexPath);
};

app.whenReady().then(() => {
  void main();
  createWindow();
});
