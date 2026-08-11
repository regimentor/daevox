import classNames from "classnames";
import { useState } from "react";
import { useParams } from "react-router";
import { Button } from "../units/button/index.js";
import { DialogsSidebar } from "../features/dialogs/ui/dialogs-sidebar.js";
import { Chat as ChatFeature } from "../features/chat/ui/chat.js";
import styles from "./chat.module.css";

const Chat = () => {
  const { dialogId } = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!dialogId) {
    return null;
  }

  return (
    <div
      className={classNames(
        styles.page,
        isSidebarOpen && styles.pageWithSidebar,
      )}
    >
      <DialogsSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      {!isSidebarOpen && (
        <Button
          className={styles.sidebarToggle}
          variant="secondary"
          aria-label="Show dialogs"
          aria-controls="dialogs-sidebar"
          aria-expanded={false}
          title="Show dialogs"
          onClick={() => setIsSidebarOpen(true)}
        >
          <span aria-hidden="true">{"\uf0c9"}</span>
        </Button>
      )}
      <ChatFeature dialogId={dialogId} />
    </div>
  );
};

export { Chat };
