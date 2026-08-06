import { app, BrowserWindow } from "electron";
import { main } from "./src/main.js";

console.log("Hello, World!");


const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  win.loadFile("../index.html");
};

app.whenReady().then(() => {
  main();
  createWindow();
});
