import classNames from "classnames";
import { isValidElement, useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type {
  AgentGenerationMetrics,
  AgentSource,
  AgentToolCall,
} from "@daevox/contracts";
import { Thinking, type ThinkingProps } from "../thinking/index.js";
import { ToolCalls } from "../tool-calls/index.js";
import { GenerationMetrics } from "./generation-metrics.js";
import { Sources } from "../sources/index.js";
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
  sources?: AgentSource[];
  sourcesComplete?: boolean;
  metrics?: AgentGenerationMetrics;
  onCopy?: () => void;
};

const supportedLanguages = new Set([
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "markdown",
  "md",
  "php",
  "python",
  "rust",
  "shell",
  "sh",
  "sql",
  "swift",
  "tsx",
  "typescript",
  "ts",
  "xml",
  "yaml",
  "yml",
]);

const getNodeText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
};

const getNodeLanguage = (node: ReactNode): string | undefined => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const language = getNodeLanguage(child);

      if (language) {
        return language;
      }
    }

    return undefined;
  }

  if (isValidElement<{ className?: string; children?: ReactNode }>(node)) {
    const language = node.props.className?.match(/language-([\w-]+)/)?.[1];

    return language ?? getNodeLanguage(node.props.children);
  }

  return undefined;
};

type CodeBlockProps = {
  code: string;
  language?: string | undefined;
  children: ReactNode;
};

const CodeBlock = ({ code, language, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      // Clipboard access can be unavailable in an insecure browser context.
    }
  };

  return (
    <div className={styles.codeBlock}>
      {language ? (
        <span className={styles.codeLanguage}>{language}</span>
      ) : null}
      <button
        type="button"
        className={styles.codeCopyButton}
        aria-label={copied ? "Code copied" : "Copy code"}
        onClick={() => void handleCopy()}
      >
        <span className={styles.copyIcon} aria-hidden="true">
          {"\uf0c5"}
        </span>
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <div className={styles.codeContent}>{children}</div>
    </div>
  );
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
  sources,
  sourcesComplete = false,
  metrics,
  onCopy,
}: MessageProps) => {
  const isRight = alignment === "right";
  const [hasThinking, setHasThinking] = useState(() => thinking !== undefined);
  const body =
    typeof children === "string" ? (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children: preChildren }) => (
            <CodeBlock
              code={getNodeText(preChildren).replace(/\n$/, "")}
              language={getNodeLanguage(preChildren)}
            >
              {preChildren}
            </CodeBlock>
          ),
          code: ({ className, children: codeChildren, ...props }) => {
            const language = className?.match(/language-([\w-]+)/)?.[1];

            if (language && supportedLanguages.has(language)) {
              return (
                <SyntaxHighlighter
                  language={language}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    padding: "2.75rem 1rem 1rem",
                    background: "transparent",
                    borderRadius: 0,
                    overflow: "visible",
                  }}
                  codeTagProps={{
                    className: styles.codeSyntax,
                    style: {
                      background: "transparent",
                      padding: 0,
                      fontFamily: "inherit",
                    },
                  }}
                  PreTag="div"
                >
                  {String(codeChildren).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            }

            return (
              <code
                className={classNames(className, styles.codePlain)}
                {...props}
              >
                {codeChildren}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
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
        <span className={styles.copyIcon} aria-hidden="true">
          {"\uf0c5"}
        </span>
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
        {sources?.length ? (
          <Sources sources={sources} isComplete={sourcesComplete} />
        ) : null}
        {metrics ? <GenerationMetrics metrics={metrics} /> : null}
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
