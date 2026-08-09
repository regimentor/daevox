import type { DialogSummary } from "@daevox/contracts";
import classNames from "classnames";
import { NavLink } from "react-router";
import { Button } from "../button/index.js";
import styles from "./dialog-item.module.css";

type DialogItemProps = {
  dialog: DialogSummary;
  disabled?: boolean;
  onDelete: (dialogId: string) => void;
};

const formatDialogDate = (createdAt: Date) =>
  createdAt.toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });

const DialogItem = ({
  dialog,
  disabled = false,
  onDelete,
}: DialogItemProps) => {
  const formattedDate = formatDialogDate(dialog.createdAt);

  return (
    <div className={styles.item}>
      <NavLink
        to={`/dialogs/${dialog.id}`}
        className={({ isActive }) =>
          classNames(styles.link, isActive && styles.linkActive)
        }
      >
        <span>Dialog</span>
        <time dateTime={dialog.createdAt.toISOString()}>{formattedDate}</time>
      </NavLink>
      <Button
        variant="danger"
        className={styles.deleteButton}
        type="button"
        aria-label={`Delete dialog from ${formattedDate}`}
        disabled={disabled}
        onClick={() => onDelete(dialog.id)}
      >
        <span aria-hidden="true">{"\uf1f8"}</span>
      </Button>
    </div>
  );
};

export { DialogItem, formatDialogDate };
export type { DialogItemProps };
