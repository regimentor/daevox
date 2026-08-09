import classNames from "classnames";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Thinking, type ThinkingProps } from "../thinking/index.js";
import { ToolCalls } from "../tool-calls/index.js";
import type { AgentToolCall } from "@daevox/contracts";
import copyIcon from "./assets/copy.svg";
import styles from "./message.module.css";

type MessageAlignment = "left" | "right";

type MessageProps = {
  className?: string;
  alignment?: MessageAlignment;
  author: string;
  timestamp: string;
  children: ReactNode;
  thinking?: ThinkingProps;
  tools?: AgentToolCall[];
  toolsComplete?: boolean;
  onCopy?: () => void;
};

const Message = ({
  className,
  alignment = "left",
  author,
  timestamp,
  children,
  thinking,
  tools,
  toolsComplete = false,
  onCopy,
}: MessageProps) => {
  const isRight = alignment === "right";
  const [hasThinking, setHasThinking] = useState(() => thinking !== undefined);
  const body =
    typeof children === "string" ? (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    ) : (
      children
    );

  useEffect(() => {
    if (thinking !== undefined) {
      setHasThinking(true);
    }
  }, [thinking]);

  const handleCopy = () => {
    if (onCopy) {
      onCopy();
      return;
    }

    if (typeof children === "string") {
      void navigator.clipboard.writeText(children);
    }
  };

  const copyControl = (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.copyButton}
        aria-label="Copy message"
        onClick={handleCopy}
      >
        <img
          src={copyIcon}
          alt=""
          className={styles.copyIcon}
          width={14}
          height={14}
        />
      </button>
    </div>
  );

  return (
    <article
      className={classNames(
        styles.root,
        isRight ? styles.right : styles.left,
        className,
      )}
    >
      {!isRight ? <div className={styles.accent} aria-hidden /> : null}
      <div className={styles.content}>
        <p className={styles.author}>{author}</p>
        {hasThinking ? <Thinking {...(thinking ?? {})} /> : null}
        {tools?.length ? (
          <ToolCalls calls={tools} isComplete={toolsComplete} />
        ) : null}
        <div className={styles.body}>{body}</div>
        <div className={styles.footer}>
          {!isRight ? copyControl : null}
          <p className={styles.timestamp}>{timestamp}</p>
          {isRight ? copyControl : null}
        </div>
      </div>
      {isRight ? <div className={styles.accent} aria-hidden /> : null}
    </article>
  );
};

export { Message };
export type { MessageAlignment, MessageProps };
