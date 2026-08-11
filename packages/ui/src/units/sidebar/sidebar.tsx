import classNames from "classnames";
import type { ReactNode } from "react";
import { useEffect } from "react";
import styles from "./sidebar.module.css";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  mainComponent: () => ReactNode;
  id?: string;
  ariaLabel?: string;
  closeLabel?: string;
};

const Sidebar = ({
  isOpen,
  onClose,
  mainComponent,
  id = "sidebar",
  ariaLabel = "Sidebar",
  closeLabel = "Close sidebar",
}: SidebarProps) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <button
        type="button"
        className={classNames(styles.backdrop, isOpen && styles.backdropOpen)}
        aria-label={closeLabel}
        aria-hidden={!isOpen}
        disabled={!isOpen}
        onClick={onClose}
      />
      <aside
        id={id}
        className={classNames(styles.sidebar, isOpen && styles.sidebarOpen)}
        aria-label={ariaLabel}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        {mainComponent()}
      </aside>
    </>
  );
};

export { Sidebar };
export type { SidebarProps };
