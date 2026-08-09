import { useEffect, useState } from "react";
import type { AgentSource } from "@daevox/contracts";
import styles from "./sources.module.css";

type SourcesProps = {
  sources: AgentSource[];
  isComplete?: boolean;
};

const siteFaviconUrl = (sourceUrl: string) => {
  const url = new URL(sourceUrl);
  return `${url.origin}/favicon.ico`;
};

const faviconFallbackUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

const SourceIcon = ({ source }: { source: AgentSource }) => {
  const fallbackUrl = faviconFallbackUrl(source.domain);
  const [iconUrl, setIconUrl] = useState(() => siteFaviconUrl(source.url));
  const [hasFavicon, setHasFavicon] = useState(true);

  const handleFaviconError = () => {
    if (iconUrl !== fallbackUrl) {
      setIconUrl(fallbackUrl);
      return;
    }

    setHasFavicon(false);
  };

  return (
    <span className={styles.icon} aria-hidden="true">
      <span className={styles.fallback}>
        {source.domain.charAt(0).toUpperCase()}
      </span>
      {hasFavicon && (
        <img
          className={styles.favicon}
          src={iconUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleFaviconError}
        />
      )}
    </span>
  );
};

const CopyIcon = () => (
  <svg
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M2.333 9.333A1.167 1.167 0 0 1 1.166 8.166V2.333a1.167 1.167 0 0 1 1.167-1.167h5.834a1.167 1.167 0 0 1 1.166 1.167M5.833 4.666h5.834c.644 0 1.167.523 1.167 1.167v5.834c0 .644-.523 1.167-1.167 1.167H5.833a1.167 1.167 0 0 1-1.167-1.167V5.833c0-.644.523-1.167 1.167-1.167Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M8.167 1.75h3.5v3.5M11.667 1.75 7.583 5.833M6.417 2.917H3.5a1.167 1.167 0 0 0-1.167 1.166v6.417A1.167 1.167 0 0 0 3.5 11.667h6.417a1.167 1.167 0 0 0 1.166-1.167V7.583"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SourceActions = ({ source }: { source: AgentSource }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleOpen = () => {
    window.open(source.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={styles.actions}>
      <button
        className={styles.action}
        type="button"
        aria-label={copied ? "Source link copied" : "Copy source link"}
        title={copied ? "Copied" : "Copy link"}
        onClick={() => void handleCopy()}
      >
        <CopyIcon />
      </button>
      <button
        className={styles.action}
        type="button"
        aria-label="Open source in external browser"
        title="Open in browser"
        onClick={handleOpen}
      >
        <ExternalLinkIcon />
      </button>
    </div>
  );
};

const Sources = ({ sources, isComplete = false }: SourcesProps) => {
  const [open, setOpen] = useState(false);
  const previewSources = sources.slice(0, 3);

  useEffect(() => {
    if (isComplete) {
      setOpen(false);
    }
  }, [isComplete]);

  return (
    <details
      className={styles.root}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      aria-label="Sources"
    >
      <summary className={styles.summary}>
        <span>Sources</span>
        <span className={styles.count}>{sources.length}</span>
        <span className={styles.preview} aria-hidden="true">
          {previewSources.map((source) => (
            <SourceIcon key={source.sourceId} source={source} />
          ))}
        </span>
      </summary>
      <div className={styles.list}>
        {sources.map((source) => (
          <div
            className={styles.source}
            key={source.sourceId}
          >
            <a
              className={styles.sourceLink}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              <SourceIcon source={source} />
              <span className={styles.sourceText}>
                <span className={styles.title}>{source.title}</span>
                <span className={styles.domain}>{source.domain}</span>
              </span>
            </a>
            <SourceActions source={source} />
          </div>
        ))}
      </div>
    </details>
  );
};

export { Sources };
export type { SourcesProps };
