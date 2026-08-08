import { Outlet } from "react-router";
import classNames from "classnames";
import { Header, Main } from "./layout/index.js";

import styles from "./app.module.css";

const App = () => {
  return (
    <div className={classNames("dark", styles.app)}>
      <Header />
      <Main>
        <Outlet />
      </Main>
    </div>
  );
};

export { App };
