import type { AgentGenerationMetrics } from "@daevox/contracts";
import styles from "./message.module.css";

type GenerationMetricsProps = {
  metrics: AgentGenerationMetrics;
};

const formatRate = (rate: number) => {
  if (rate >= 100) {
    return Math.round(rate).toString();
  }

  if (rate >= 10) {
    return rate.toFixed(1);
  }

  return rate.toFixed(2);
};

const GenerationMetrics = ({ metrics }: GenerationMetricsProps) => (
  <p className={styles.metrics} aria-label="Generation metrics">
    {metrics.estimated ? "~" : ""}
    {metrics.completionTokens} tokens · {formatRate(metrics.tokensPerSecond)}{" "}
    tok/s
  </p>
);

export { GenerationMetrics };
export type { GenerationMetricsProps };
