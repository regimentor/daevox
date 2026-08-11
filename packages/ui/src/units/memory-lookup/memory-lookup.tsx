import type { AgentMemoryLookup as AgentMemoryLookupData } from "@daevox/contracts";
import { useEffect, useState } from "react";
import styles from "./memory-lookup.module.css";

type MemoryLookupProps = {
  lookup: AgentMemoryLookupData;
  isComplete?: boolean;
};

const statusLabels: Record<AgentMemoryLookupData["status"], string> = {
  running: "running",
  complete: "done",
  error: "error",
};

const MemoryLookup = ({ lookup, isComplete = false }: MemoryLookupProps) => {
  const [open, setOpen] = useState(() => !isComplete);

  useEffect(() => {
    if (isComplete || lookup.status === "error") setOpen(false);
  }, [isComplete, lookup.status]);

  return (
    <details
      className={`${styles.root} ${styles[lookup.status]}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      aria-label="Memory lookup"
      aria-busy={lookup.status === "running"}
    >
      <summary className={styles.summary}>
        Memory{" "}
        <span className={styles.status}>{statusLabels[lookup.status]}</span>
      </summary>
      <div className={styles.details}>
        <p className={styles.query}>
          <span className={styles.label}>Query</span> {lookup.query}
        </p>
        <p className={styles.meta}>
          {lookup.resultCount} {lookup.resultCount === 1 ? "note" : "notes"}
          {lookup.status !== "running" ? ` · ${lookup.durationMs} ms` : ""}
        </p>
        {lookup.results.length > 0 ? (
          <ul className={styles.results}>
            {lookup.results.map((result) => (
              <li key={`${result.path}:${result.title}`}>
                <span>{result.title}</span>
                <code>{result.path}</code>
              </li>
            ))}
          </ul>
        ) : null}
        {lookup.error ? <p className={styles.error}>{lookup.error}</p> : null}
      </div>
    </details>
  );
};

export { MemoryLookup };
export type { MemoryLookupProps };
