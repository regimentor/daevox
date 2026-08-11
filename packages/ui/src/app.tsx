import { Outlet } from "react-router";
import classNames from "classnames";
import { useEffect, useState } from "react";
import { Header, Main } from "./layout/index.js";
import { uiApi } from "./api.js";
import { CompletionErrorNotification } from "./units/notification/notification.js";
import type { CompletionErrorEvent } from "@daevox/contracts";

import styles from "./app.module.css";

const App = () => {
  const [completionError, setCompletionError] =
    useState<CompletionErrorEvent | null>(null);

  useEffect(() => {
    uiApi.onCompletionError(setCompletionError);
  }, []);

  return (
    <div className={classNames("dark", styles.app)}>
      <Header />
      <Main>
        <div className={styles.content}>
          <Outlet />
        </div>
      </Main>
      <CompletionErrorNotification
        event={completionError}
        onDismiss={() => setCompletionError(null)}
      />
    </div>
  );
};

export { App };
