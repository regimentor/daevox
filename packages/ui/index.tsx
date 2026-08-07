import { createRoot } from "react-dom/client";
import { createHashRouter, Outlet } from "react-router";
import { RouterProvider } from "react-router/dom";
import { App } from "./src/app.js";
import { Home } from "./src/pages/home.js";


import "./index.css";

const router = createHashRouter([
  {
    path: "/",
    Component: App,
    children: [
      {
        path: "/",
        Component: Home,
      },
    ],
  },
]);

function main() {
  const root = document.getElementById("root") as HTMLDivElement;
  createRoot(root).render(<RouterProvider router={router} />);
}

export { main };
