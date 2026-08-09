import { Outlet } from "react-router";
import classNames from "classnames";
import { Header, Main } from "./layout/index.js";
import { DialogsSidebar } from "./features/dialogs/ui/dialogs-sidebar.js";

import styles from "./app.module.css";

const App = () => {
  return (
    <div className={classNames("dark", styles.app)}>
      <Header />
      <Main>
        <DialogsSidebar />
        <div className={styles.content}>
          <Outlet />
        </div>
      </Main>
    </div>
  );
};

export { App };
