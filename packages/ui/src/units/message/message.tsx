import classNames from "classnames";
import type { ReactNode } from "react";
import copyIcon from "./assets/copy.svg";
import styles from "./message.module.css";

type MessageAlignment = "left" | "right";

type MessageProps = {
  className?: string;
  alignment?: MessageAlignment;
  author: string;
  timestamp: string;
  children: ReactNode;
  onCopy?: () => void;
};

const Message = ({
  className,
  alignment = "left",
  author,
  timestamp,
  children,
  onCopy,
}: MessageProps) => {
  const isRight = alignment === "right";

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
        <img src={copyIcon} alt="" className={styles.copyIcon} width={14} height={14} />
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
        <p className={styles.body}>{children}</p>
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
