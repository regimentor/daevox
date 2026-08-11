import { useUnit } from "effector-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  $dialogs,
  $error,
  $isCreating,
  $isDeleting,
  $isLoading,
  createDialogFx,
  deleteDialogFx,
  initializeDialogsFx,
} from "../dialogs.store.js";
import { DialogsHeader } from "../../../units/dialogs-header/index.js";
import { DialogsList } from "../../../units/dialogs-list/index.js";
import { Button } from "../../../units/button/index.js";
import { Sidebar } from "../../../units/sidebar/index.js";
import styles from "./dialogs-sidebar.module.css";

type DialogsSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const DialogsSidebar = ({ isOpen, onClose }: DialogsSidebarProps) => {
  const dialogs = useUnit($dialogs);
  const error = useUnit($error);
  const isCreating = useUnit($isCreating);
  const isDeleting = useUnit($isDeleting);
  const isLoading = useUnit($isLoading);
  const initialize = useUnit(initializeDialogsFx);
  const create = useUnit(createDialogFx);
  const remove = useUnit(deleteDialogFx);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (dialogs.length === 0) {
      void initialize();
    }
  }, [dialogs.length, initialize]);

  useEffect(() => {
    if (location.pathname === "/" && dialogs[0]) {
      navigate(`/dialogs/${dialogs[0].id}`, { replace: true });
    }
  }, [dialogs, location.pathname, navigate]);

  const handleCreate = async () => {
    try {
      const dialog = await create();
      navigate(`/dialogs/${dialog.id}`);
    } catch {
      // The store exposes the failure through $error.
    }
  };

  const handleDelete = async (dialogId: string) => {
    if (!window.confirm("Delete this dialog?")) {
      return;
    }

    try {
      const dialog = await remove(dialogId);
      navigate(`/dialogs/${dialog.id}`);
    } catch {
      // The store exposes the failure through $error.
    }
  };

  return (
    <Sidebar
      id="dialogs-sidebar"
      ariaLabel="Dialogs"
      closeLabel="Close dialogs"
      isOpen={isOpen}
      onClose={onClose}
      mainComponent={() => (
        <div className={styles.content}>
          <div className={styles.headerRow}>
            <DialogsHeader
              isCreating={isCreating}
              onCreate={() => void handleCreate()}
            />
            <Button
              className={styles.closeButton}
              variant="secondary"
              aria-label="Hide dialogs"
              aria-controls="dialogs-sidebar"
              aria-expanded={isOpen}
              title="Hide dialogs"
              onClick={onClose}
            >
              <span aria-hidden="true">{"\uf00d"}</span>
            </Button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {isLoading && <p className={styles.muted}>Loading…</p>}
          {!isLoading && dialogs.length === 0 && (
            <p className={styles.muted}>No dialogs yet.</p>
          )}
          <DialogsList
            dialogs={dialogs}
            isDeleting={isDeleting}
            onDelete={(dialogId) => void handleDelete(dialogId)}
          />
          {isDeleting && <p className={styles.muted}>Deleting…</p>}
        </div>
      )}
    />
  );
};

export { DialogsSidebar };
export type { DialogsSidebarProps };
