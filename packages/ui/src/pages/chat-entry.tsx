import { useUnit } from "effector-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import {
  $dialogs,
  $error,
  $isLoading,
  initializeDialogsFx,
} from "../features/dialogs/dialogs.store.js";

const ChatEntry = () => {
  const dialogs = useUnit($dialogs);
  const error = useUnit($error);
  const isLoading = useUnit($isLoading);
  const initialize = useUnit(initializeDialogsFx);
  const navigate = useNavigate();

  useEffect(() => {
    if (dialogs.length === 0) {
      void initialize();
    }
  }, [dialogs.length, initialize]);

  useEffect(() => {
    const dialog = dialogs[0];
    if (dialog) {
      navigate(`/dialogs/${dialog.id}`, { replace: true });
    }
  }, [dialogs, navigate]);

  return <p>{isLoading ? "Loading…" : (error ?? "Select a dialog.")}</p>;
};

export { ChatEntry };
