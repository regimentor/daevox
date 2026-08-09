import { allSettled, fork } from "effector";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uiApi } from "../../api.js";
import {
  $dialogs,
  $error,
  $isLoading,
  addDialog,
  createDialogFx,
  deleteDialogFx,
  initializeDialogsFx,
  removeDialog,
  setDialogs,
} from "./dialogs.store.js";

const firstDialog = {
  id: "dialog-1",
  createdAt: new Date("2026-08-09T09:00:00.000Z"),
  updatedAt: new Date("2026-08-09T09:00:00.000Z"),
};

const secondDialog = {
  id: "dialog-2",
  createdAt: new Date("2026-08-09T10:00:00.000Z"),
  updatedAt: new Date("2026-08-09T10:00:00.000Z"),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dialogs store", () => {
  test("replaces, adds, and removes dialogs", async () => {
    const scope = fork();

    await allSettled(setDialogs, {
      scope,
      params: [firstDialog],
    });
    await allSettled(addDialog, {
      scope,
      params: secondDialog,
    });
    expect(scope.getState($dialogs)).toEqual([secondDialog, firstDialog]);

    await allSettled(removeDialog, {
      scope,
      params: firstDialog.id,
    });
    expect(scope.getState($dialogs)).toEqual([secondDialog]);
  });

  test("loads dialogs and creates the first dialog when the API is empty", async () => {
    vi.spyOn(uiApi, "listDialogs").mockResolvedValue([]);
    vi.spyOn(uiApi, "isConfigured").mockReturnValue(true);
    vi.spyOn(uiApi, "createDialog").mockResolvedValue(firstDialog);
    const scope = fork();

    await allSettled(initializeDialogsFx, {
      scope,
      params: undefined,
    });

    expect(scope.getState($dialogs)).toEqual([firstDialog]);
    expect(uiApi.createDialog).toHaveBeenCalledOnce();
  });

  test("does not create a dialog when the API is unavailable", async () => {
    vi.spyOn(uiApi, "listDialogs").mockResolvedValue([]);
    vi.spyOn(uiApi, "isConfigured").mockReturnValue(false);
    const createDialog = vi.spyOn(uiApi, "createDialog");
    const scope = fork();

    await allSettled(initializeDialogsFx, {
      scope,
      params: undefined,
    });

    expect(scope.getState($dialogs)).toEqual([]);
    expect(createDialog).not.toHaveBeenCalled();
  });

  test("creates a dialog and prepends it to the store", async () => {
    vi.spyOn(uiApi, "createDialog").mockResolvedValue(secondDialog);
    const scope = fork({
      values: [[$dialogs, [firstDialog]]],
    });

    await allSettled(createDialogFx, {
      scope,
      params: undefined,
    });

    expect(scope.getState($dialogs)).toEqual([secondDialog, firstDialog]);
  });

  test("deletes a dialog and creates its replacement", async () => {
    vi.spyOn(uiApi, "deleteDialog").mockResolvedValue(undefined);
    vi.spyOn(uiApi, "createDialog").mockResolvedValue(secondDialog);
    const scope = fork({
      values: [[$dialogs, [firstDialog]]],
    });

    await allSettled(deleteDialogFx, {
      scope,
      params: firstDialog.id,
    });

    expect(uiApi.deleteDialog).toHaveBeenCalledWith(firstDialog.id);
    expect(scope.getState($dialogs)).toEqual([secondDialog]);
  });

  test("stores effect failures as an error message", async () => {
    vi.spyOn(uiApi, "listDialogs").mockRejectedValue(
      new Error("Dialog service unavailable"),
    );
    const scope = fork();

    await allSettled(initializeDialogsFx, {
      scope,
      params: undefined,
    });

    expect(scope.getState($error)).toBe("Dialog service unavailable");
    expect(scope.getState($isLoading)).toBe(false);
  });
});
