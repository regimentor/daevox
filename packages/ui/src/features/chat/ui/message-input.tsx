import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Textarea } from "../../../units/textarea/index.js";
import styles from "./message-input.module.css";

type MessageInputProps = {
  onSubmit?: (content: string) => void | Promise<void>;
  isSending?: boolean;
};

const MessageInput = ({
  onSubmit,
  isSending = false,
}: MessageInputProps) => {
  const [content, setContent] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = content.trim();
    if (!message || !onSubmit || isSending) {
      return;
    }

    try {
      await onSubmit(message);
      setContent("");
    } catch {
      // Keep the draft available for retry when the agent request fails.
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      !event.ctrlKey ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <Textarea
        aria-label="Message"
        {...(isSending ? { className: styles.sending } : {})}
        placeholder="Write a message..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className={styles.submit}
        type="submit"
        disabled={isSending || !content.trim()}
      >
        Send
      </button>
    </form>
  );
};

export { MessageInput };
export type { MessageInputProps };
