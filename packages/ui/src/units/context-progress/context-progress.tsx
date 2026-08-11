import classNames from "classnames";
import styles from "./context-progress.module.css";

type ContextProgressProps = {
  promptTokens?: number | undefined;
  contextWindowTokens?: number | undefined;
};

const ContextProgress = ({
  promptTokens,
  contextWindowTokens,
}: ContextProgressProps) => {
  if (
    promptTokens === undefined ||
    contextWindowTokens === undefined ||
    !Number.isFinite(promptTokens) ||
    !Number.isFinite(contextWindowTokens) ||
    promptTokens < 0 ||
    contextWindowTokens <= 0
  ) {
    return null;
  }

  const percentage = Math.min(
    100,
    Math.max(0, (promptTokens / contextWindowTokens) * 100),
  );
  const fillClass =
    percentage >= 95
      ? styles.contextProgressDanger
      : percentage >= 80
        ? styles.contextProgressWarning
        : styles.contextProgressNormal;

  return (
    <div className={styles.contextUsage}>
      <div className={styles.contextProgressTrack}>
        <div
          className={classNames(styles.contextProgress, fillClass)}
          role="progressbar"
          aria-label="Context usage"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={styles.contextLabel}>
        Ctx: {promptTokens} / {contextWindowTokens} t
      </span>
    </div>
  );
};

export { ContextProgress };
export type { ContextProgressProps };
