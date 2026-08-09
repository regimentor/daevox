import { useLayoutEffect } from "react";
import { Message } from "../../../units/message/index.js";
import type { AgentStreamState, ChatMessage } from "../chat.store.js";
import styles from "./chat.module.css";

type MessageHistoryProps = {
  messages: ChatMessage[];
  agentStream: AgentStreamState | null;
  isSending: boolean;
};

const formatTimestamp = (createdAt: Date) =>
  createdAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const MessageHistory = ({
  messages,
  agentStream,
  isSending,
}: MessageHistoryProps) => {
  const liveAgent =
    (isSending && agentStream?.status !== "complete") ||
    agentStream?.status === "streaming" ||
    Boolean(agentStream?.response);

  useLayoutEffect(() => {
    const scrollPageToBottom = () => {
      const { body, documentElement } = document;
      const pageHeight = Math.max(
        body.scrollHeight,
        documentElement.scrollHeight,
      );

      window.scrollTo(0, pageHeight);
    };

    scrollPageToBottom();
    const frameId = window.requestAnimationFrame(scrollPageToBottom);

    return () => window.cancelAnimationFrame(frameId);
  }, [agentStream, isSending, messages]);

  return (
    <div
      className={styles.history}
      role="log"
      aria-live="polite"
      aria-label="Message history"
    >
      {messages.length === 0 && !liveAgent ? (
        <p className={styles.empty}>No messages yet.</p>
      ) : (
        <>
          {messages.map((message, index) => (
            <Message
              key={`${message.createdAt.toISOString()}-${index}`}
              alignment={message.actor === "user" ? "right" : "left"}
              author={message.actor === "user" ? "You" : "Daevox"}
              timestamp={formatTimestamp(message.createdAt)}
              {...(message.tools?.length
                ? { tools: message.tools, toolsComplete: true }
                : {})}
              {...(message.actor === "agent" &&
              index === messages.length - 1 &&
              agentStream?.status === "complete"
                ? {
                    thinking: {
                      content: agentStream.reasoning,
                      isComplete: true,
                    },
                    tools: agentStream.tools,
                    toolsComplete: true,
                  }
                : {})}
            >
              {message.content}
            </Message>
          ))}
          {liveAgent ? (
            <Message
              key={agentStream?.requestId ?? "pending-agent"}
              alignment="left"
              author="Daevox"
              timestamp={formatTimestamp(new Date())}
              thinking={{
                content: agentStream?.reasoning ?? "",
                isComplete: agentStream?.status === "complete",
              }}
              {...(agentStream?.tools.length
                ? {
                    tools: agentStream.tools,
                    toolsComplete: agentStream.status === "complete",
                  }
                : {})}
            >
              {agentStream?.response ?? ""}
            </Message>
          ) : null}
        </>
      )}
    </div>
  );
};

export { MessageHistory };
export type { MessageHistoryProps };
