import classNames from "classnames";
import type { ComponentProps } from "react";
import { useId } from "react";
import styles from "./textarea.module.css";

type TextareaProps = Omit<ComponentProps<"textarea">, "className"> & {
  className?: string;
  label?: string;
  helperText?: string;
  error?: boolean | string;
};

const Textarea = ({
  className,
  label,
  helperText,
  error = false,
  id: idProp,
  disabled,
  ...props
}: TextareaProps) => {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const helperId = `${id}-helper`;
  const isError = Boolean(error);
  const helper = typeof error === "string" && error.length > 0 ? error : helperText;

  return (
    <div
      className={classNames(styles.root, isError && styles.error, className)}
    >
      {label ? (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      ) : null}
      <textarea
        {...props}
        id={id}
        disabled={disabled}
        className={styles.textarea}
        aria-invalid={isError || undefined}
        aria-describedby={helper ? helperId : undefined}
      />
      {helper ? (
        <p id={helperId} className={styles.helper}>
          {helper}
        </p>
      ) : null}
    </div>
  );
};

export { Textarea };
export type { TextareaProps };
