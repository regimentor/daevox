import { useState, type FormEvent } from "react";
import { Textarea } from "../../../units/textarea/index.js";
import styles from "./message-input.module.css";

type MessageInputProps = {
  onSubmit?: (content: string) => void;
};

const MessageInput = ({ onSubmit }: MessageInputProps) => {
  const [content, setContent] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = content.trim();
    if (!message || !onSubmit) {
      return;
    }

    onSubmit(message);
    setContent("");
  };

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <Textarea
        aria-label="Message"
        placeholder="Write a message..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <button className={styles.submit} type="submit" disabled={!content.trim()}>
        Send
      </button>
    </form>
  );
};

export { MessageInput };
export type { MessageInputProps };
