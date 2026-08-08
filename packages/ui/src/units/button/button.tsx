import classNames from "classnames";
import type { ComponentProps } from "react";
import styles from "./button.module.css";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const Button = ({
  className,
  variant = "primary",
  size = "sm",
  type = "button",
  ...props
}: ButtonProps) => {
  return (
    <button
      {...props}
      type={type}
      className={classNames(styles.button, styles[variant], styles[size], className)}
    />
  );
};

export { Button };
export type { ButtonProps, ButtonSize, ButtonVariant };
