import classNames from "classnames";
import { useUnit } from "effector-react";
import { useState } from "react";
import { uiApi } from "../../../api.js";
import {
  $agentStream,
  $messages,
  addMessage,
  clearAgentStream,
} from "../chat.store.js";
import { MessageInput } from "./message-input.js";
import { MessageHistory } from "./message-history.js";
import styles from "./chat.module.css";

type ChatProps = {
  className?: string;
};

const Chat = ({ className }: ChatProps) => {
  const messages = useUnit($messages);
  const agentStream = useUnit($agentStream);
  const add = useUnit(addMessage);
  const clearStream = useUnit(clearAgentStream);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (content: string) => {
    const message = {
      actor: "user",
      type: "completion",
      content,
      createdAt: new Date(),
    } as const;

    if (uiApi.isConfigured()) {
      setIsSending(true);
      try {
        await uiApi.addMessage(message);
      } catch (error) {
        clearStream();
        throw error;
      } finally {
        setIsSending(false);
      }
      return;
    }

    add(message);
  };

  return (
    <section className={classNames(styles.root, className)} aria-label="Chat">
      <MessageHistory
        messages={messages}
        agentStream={agentStream}
        isSending={isSending}
      />
      <MessageInput onSubmit={handleSubmit} isSending={isSending} />
    </section>
  );
};

export { Chat };
export type { ChatProps };
