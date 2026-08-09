import type { DialogSummary } from "@daevox/contracts";
import { DialogItem } from "../dialog-item/index.js";
import styles from "./dialogs-list.module.css";

type DialogsListProps = {
  dialogs: readonly DialogSummary[];
  isDeleting?: boolean;
  onDelete: (dialogId: string) => void;
};

const DialogsList = ({
  dialogs,
  isDeleting = false,
  onDelete,
}: DialogsListProps) => {
  return (
    <div className={styles.list}>
      {dialogs.map((dialog) => (
        <DialogItem
          key={dialog.id}
          dialog={dialog}
          disabled={isDeleting}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export { DialogsList };
export type { DialogsListProps };
