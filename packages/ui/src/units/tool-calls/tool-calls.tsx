import { useEffect, useState } from "react";
import type { AgentToolCall } from "@daevox/contracts";
import styles from "./tool-calls.module.css";

type ToolCallsProps = {
  calls: AgentToolCall[];
  isComplete?: boolean;
};

const statusLabels: Record<AgentToolCall["status"], string> = {
  running: "running",
  complete: "done",
  error: "error",
};

const ToolCalls = ({ calls, isComplete = false }: ToolCallsProps) => {
  const [open, setOpen] = useState(() => !isComplete);

  useEffect(() => {
    if (isComplete) {
      setOpen(false);
    }
  }, [isComplete]);

  return (
    <details
      className={styles.root}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      aria-label="Tool calls"
    >
      <summary className={styles.summary}>
        Tools <span className={styles.count}>{calls.length}</span>
      </summary>
      <div className={styles.list}>
        {calls.map((call) => (
          <div className={styles.call} key={call.toolCallId}>
            <div className={styles.callHeader}>
              <span className={styles.name}>{call.name}</span>
              <span className={`${styles.status} ${styles[call.status]}`}>
                <span className={styles.statusDot} aria-hidden />
                {statusLabels[call.status]}
                {call.status !== "running" && call.durationMs > 0
                  ? ` · ${call.durationMs} ms`
                  : ""}
              </span>
            </div>
            {call.input ? (
              <code className={styles.input}>{call.input}</code>
            ) : null}
            {call.error ? <p className={styles.error}>{call.error}</p> : null}
          </div>
        ))}
      </div>
    </details>
  );
};

export { ToolCalls };
export type { ToolCallsProps };
