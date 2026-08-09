import type { DialogSummary } from "@daevox/contracts";
import { createEffect, createEvent, createStore } from "effector";
import { uiApi } from "../../api.js";

const initializeDialogsFx = createEffect<void, DialogSummary[]>(async () => {
  const dialogs = await uiApi.listDialogs();

  if (dialogs.length === 0 && uiApi.isConfigured()) {
    return [await uiApi.createDialog()];
  }

  return dialogs;
});

const createDialogFx = createEffect<void, DialogSummary>(async () => {
  return uiApi.createDialog();
});

const deleteDialogFx = createEffect<string, DialogSummary>(async (dialogId) => {
  await uiApi.deleteDialog(dialogId);
  return uiApi.createDialog();
});

const setDialogs = createEvent<DialogSummary[]>();
const addDialog = createEvent<DialogSummary>();
const removeDialog = createEvent<string>();

const $dialogs = createStore<DialogSummary[]>([])
  .on(setDialogs, (_, dialogs) => dialogs)
  .on(initializeDialogsFx.doneData, (_, dialogs) => dialogs)
  .on(addDialog, (dialogs, dialog) => [dialog, ...dialogs])
  .on(createDialogFx.doneData, (dialogs, dialog) => [dialog, ...dialogs])
  .on(deleteDialogFx.done, (dialogs, { params: dialogId, result }) => [
    result,
    ...dialogs.filter((dialog) => dialog.id !== dialogId),
  ])
  .on(removeDialog, (dialogs, dialogId) =>
    dialogs.filter((dialog) => dialog.id !== dialogId),
  );

const $isLoading = initializeDialogsFx.pending;
const $isCreating = createDialogFx.pending;
const $isDeleting = deleteDialogFx.pending;

const $error = createStore<string | null>(null)
  .on(initializeDialogsFx, () => null)
  .on(createDialogFx, () => null)
  .on(deleteDialogFx, () => null)
  .on(initializeDialogsFx.failData, (_, error) =>
    error instanceof Error ? error.message : "Failed to load dialogs.",
  )
  .on(createDialogFx.failData, (_, error) =>
    error instanceof Error ? error.message : "Failed to create dialog.",
  )
  .on(deleteDialogFx.failData, (_, error) =>
    error instanceof Error ? error.message : "Failed to delete dialog.",
  );

export {
  $dialogs,
  $error,
  $isCreating,
  $isDeleting,
  $isLoading,
  addDialog,
  createDialogFx,
  deleteDialogFx,
  initializeDialogsFx,
  removeDialog,
  setDialogs,
};
