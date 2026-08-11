import { createRoot } from "react-dom/client";
import { createHashRouter, Outlet } from "react-router";
import { RouterProvider } from "react-router/dom";
import { App } from "./src/app.js";
import { Chat } from "./src/pages/chat.js";
import { ChatEntry } from "./src/pages/chat-entry.js";

import "./index.css";
import type { Api } from "@daevox/contracts";
import { uiApi } from "./src/api.js";

const router = createHashRouter([
  {
    path: "/",
    Component: App,
    children: [
      {
        path: "/",
        Component: ChatEntry,
      },
      {
        path: "/dialogs/:dialogId",
        Component: Chat,
      },
    ],
  },
]);

function main(api: Api) {
  uiApi.setImplementation(api);

  const root = document.getElementById("root") as HTMLDivElement;
  createRoot(root).render(<RouterProvider router={router} />);
}

export { main, uiApi };
