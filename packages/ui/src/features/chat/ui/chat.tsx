import classNames from "classnames";
import { useUnit } from "effector-react";
import { useEffect, useState } from "react";
import { uiApi } from "../../../api.js";
import {
  $agentStream,
  $messages,
  addMessage,
  clearAgentStream,
  replaceMessages,
  setActiveDialog,
} from "../chat.store.js";
import { MessageInput } from "./message-input.js";
import { MessageHistory } from "./message-history.js";
import styles from "./chat.module.css";

type ChatProps = {
  dialogId?: string;
  className?: string;
};

const Chat = ({ dialogId = "local-dialog", className }: ChatProps) => {
  const messages = useUnit($messages);
  const agentStream = useUnit($agentStream);
  const add = useUnit(addMessage);
  const clearStream = useUnit(clearAgentStream);
  const replace = useUnit(replaceMessages);
  const setActive = useUnit(setActiveDialog);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setActive(dialogId);
    setIsSending(false);
    if (!uiApi.isConfigured()) {
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    replace([]);
    clearStream();
    setIsLoading(true);
    setLoadError(null);

    void uiApi
      .getDialogMessages(dialogId)
      .then((loadedMessages) => {
        if (mounted) {
          replace(loadedMessages);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load dialog messages.",
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [clearStream, dialogId, replace, setActive]);

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
        await uiApi.addMessage(dialogId, message);
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
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      )}
      <MessageHistory
        messages={messages}
        agentStream={agentStream}
        isSending={isSending}
        isLoading={isLoading}
      />
      <MessageInput
        onSubmit={handleSubmit}
        isSending={isSending || isLoading}
      />
    </section>
  );
};

export { Chat };
export type { ChatProps };
