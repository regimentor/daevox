import { Button } from "../button/index.js";
import styles from "./dialogs-header.module.css";

type DialogsHeaderProps = {
  isCreating: boolean;
  onCreate: () => void;
};

const DialogsHeader = ({ isCreating, onCreate }: DialogsHeaderProps) => {
  const label = isCreating ? "Creating dialog" : "New dialog";

  return (
    <div className={styles.heading}>
      <h2>Dialogs</h2>
      <Button
        className={styles.newDialogButton}
        onClick={onCreate}
        disabled={isCreating}
        aria-label={label}
        title={label}
      >
        <span className={styles.newDialogIcon} aria-hidden="true">
          {"\uf067"}
        </span>
      </Button>
    </div>
  );
};

export { DialogsHeader };
export type { DialogsHeaderProps };
