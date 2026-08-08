import classNames from "classnames";
import { useUnit } from "effector-react";
import { Message } from "../../../units/message/index.js";
import { $messages, addMessage } from "../chat.store.js";
import { MessageInput } from "./message-input.js";
import styles from "./chat.module.css";

type ChatProps = {
  className?: string;
};

const formatTimestamp = (createdAt: Date) =>
  createdAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const Chat = ({ className }: ChatProps) => {
  const messages = useUnit($messages);
  const add = useUnit(addMessage);

  const handleSubmit = (content: string) => {
    add({
      actor: "user",
      type: "completion",
      content,
      createdAt: new Date(),
    });
  };

  return (
    <section className={classNames(styles.root, className)} aria-label="Chat">
      <div className={styles.history} role="log" aria-live="polite" aria-label="Message history">
        {messages.length === 0 ? (
          <p className={styles.empty}>No messages yet.</p>
        ) : (
          messages.map((message, index) => (
            <Message
              key={`${message.createdAt.toISOString()}-${index}`}
              alignment={message.actor === "user" ? "right" : "left"}
              author={message.actor === "user" ? "You" : "Daevox"}
              timestamp={formatTimestamp(message.createdAt)}
            >
              {message.content}
            </Message>
          ))
        )}
      </div>
      <MessageInput onSubmit={handleSubmit} />
    </section>
  );
};

export { Chat };
export type { ChatProps };
