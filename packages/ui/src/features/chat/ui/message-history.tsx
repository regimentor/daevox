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

const getAuthorProps = (isUserMessage: boolean) => {
  if (isUserMessage) {
    return {
      alignment: "right" as const,
      author: "You" as const,
    };
  }

  return {
    alignment: "left" as const,
    author: "Daevox" as const,
  };
};

const getMessageProps = (
  message: ChatMessage,
  index: number,
  messagesLength: number,
  agentStream: AgentStreamState | null,
) => {
  const isUserMessage = message.actor === "user";
  const isCompletedLastAgentMessage =
    message.actor === "agent" &&
    index === messagesLength - 1 &&
    agentStream?.status === "complete";
  const hasReasoning = Boolean(agentStream?.reasoning.trim());

  return {
    ...getAuthorProps(isUserMessage),
    timestamp: formatTimestamp(message.createdAt),
    ...(message.tools?.length && {
      tools: message.tools,
      toolsComplete: true,
    }),
    ...(message.sources?.length && {
      sources: message.sources,
      sourcesComplete: true,
    }),
    ...(message.metrics && {
      metrics: message.metrics,
    }),
    ...(isCompletedLastAgentMessage &&
      agentStream && {
        ...(hasReasoning
          ? {
              thinking: {
                content: agentStream.reasoning,
                isComplete: true,
              },
            }
          : {}),
        tools: agentStream.tools,
        toolsComplete: true,
      }),
  };
};

const MessageHistory = ({
  messages,
  agentStream,
  isSending,
}: MessageHistoryProps) => {
  const liveAgent =
    agentStream !== null &&
    (agentStream.status === "streaming" || Boolean(agentStream.response));

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
      {messages.length === 0 && !liveAgent && (
        <p className={styles.empty}>No messages yet.</p>
      )}
      <>
        {messages.map((message, index) => (
          <Message
            key={`${message.createdAt.toISOString()}-${index}`}
            {...getMessageProps(message, index, messages.length, agentStream)}
          >
            {message.content}
          </Message>
        ))}
        {liveAgent && (
          <Message
            key={agentStream?.requestId ?? "pending-agent"}
            alignment="left"
            author="Daevox"
            timestamp={formatTimestamp(new Date())}
            {...(agentStream?.reasoning.trim()
              ? {
                  thinking: {
                    content: agentStream.reasoning,
                    isComplete: agentStream.status === "complete",
                  },
                }
              : {})}
            {...(agentStream?.tools.length && {
              tools: agentStream.tools,
              toolsComplete: agentStream.status === "complete",
            })}
            {...(agentStream?.sources.length && {
              sources: agentStream.sources,
              sourcesComplete: agentStream.status === "complete",
            })}
          >
            {agentStream?.response ?? ""}
          </Message>
        )}
      </>
    </div>
  );
};

export { MessageHistory };
export type { MessageHistoryProps };
