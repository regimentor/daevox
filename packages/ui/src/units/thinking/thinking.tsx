import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./thinking.module.css";

type ThinkingProps = {
  content?: string;
  isComplete?: boolean;
};

const Thinking = ({ content, isComplete = false }: ThinkingProps) => {
  const [open, setOpen] = useState(() => !isComplete);
  const [localContent, setLocalContent] = useState(() => content ?? "");
  const contentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (content) {
      setLocalContent(content);
    }
  }, [content]);

  useEffect(() => {
    if (isComplete) {
      setOpen(false);
    }
  }, [isComplete]);

  useLayoutEffect(() => {
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.scrollTop = contentElement.scrollHeight;
    }
  }, [localContent]);

  return (
    <details
      className={[styles.root, !isComplete && styles.active]
        .filter(Boolean)
        .join(" ")}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      aria-label="Agent thinking"
      aria-busy={!isComplete}
    >
      <summary className={styles.summary}>Thinking</summary>
      <p ref={contentRef} className={styles.content}>
        {localContent || "Daevox is thinking…"}
      </p>
    </details>
  );
};

export { Thinking };
export type { ThinkingProps };
