import type { ReactNode } from "react";
import styles from "./main.module.css";

type MainProps = {
  children: ReactNode;
};

const Main = ({ children }: MainProps) => {
  return (
    <div className={styles.container}>
      <main className={styles.main}>{children}</main>
    </div>
  );
};

export { Main };
export type { MainProps };
