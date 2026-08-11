import type { Message, StoredMessage } from "@daevox/contracts";
import { MemoryGroomer } from "@daevox/memory-groomer";
import { DialogsMessagesRepository, DialogsRepository } from "@daevox/storage";
import { describe, expect, test, vi } from "vitest";
import { MemoryGroomerService } from "./memory-groomer.service.js";

const message: Message = {
  actor: "user",
  type: "user",
  content: "Remember this",
  createdAt: new Date("2026-08-10T10:00:00.000Z"),
};

const storedMessage: StoredMessage = {
  id: "message-1",
  actor: message.actor,
  type: message.type,
  content: message.content,
  createdAt: message.createdAt,
  tools: null,
  sources: null,
  metrics: null,
  memory: null,
};

const makeService = (overrides: {
  findLatest?: () => Promise<{ id: string } | null>;
  findMessages?: () => Promise<StoredMessage[]>;
  groom?: (messages: Message[]) => Promise<unknown>;
  mark?: (id: string) => Promise<unknown>;
} = {}) => {
  const dialogs = {
    findLatestUngroomedWithMessages:
      overrides.findLatest ?? vi.fn(async () => ({ id: "dialog-1" })),
    markMemoryGroomed: overrides.mark ?? vi.fn(async () => undefined),
  } as unknown as DialogsRepository;
  const messages = {
    findByDialogId:
      overrides.findMessages ?? vi.fn(async () => [storedMessage]),
  } as unknown as DialogsMessagesRepository;
  const groomer = {
    groom: overrides.groom ?? vi.fn(async () => ({ response: "ok", toolCalls: [] })),
  } as unknown as MemoryGroomer;

  return {
    service: new MemoryGroomerService(dialogs, messages, groomer),
    dialogs,
    messages,
    groomer,
  };
};

describe("MemoryGroomerService", () => {
  test("does nothing when there is no dialog or the selected dialog is empty", async () => {
    const noDialog = makeService({ findLatest: vi.fn(async () => null) });
    await noDialog.service.onCreateNewDialog({});
    expect(noDialog.groomer.groom).not.toHaveBeenCalled();

    const empty = makeService({ findMessages: vi.fn(async () => []) });
    await empty.service.onCreateNewDialog({});
    expect(empty.groomer.groom).not.toHaveBeenCalled();
    expect(empty.dialogs.markMemoryGroomed).not.toHaveBeenCalled();
  });

  test("grooms the selected history and marks it only after success", async () => {
    const { service, groomer, dialogs, messages } = makeService();

    await service.onCreateNewDialog({});

    expect(messages.findByDialogId).toHaveBeenCalledWith("dialog-1");
    expect(groomer.groom).toHaveBeenCalledWith([message]);
    expect(dialogs.markMemoryGroomed).toHaveBeenCalledWith("dialog-1");
  });

  test("leaves the dialog unmarked when grooming fails", async () => {
    const error = new Error("grooming unavailable");
    const { service, dialogs } = makeService({
      groom: vi.fn(async () => {
        throw error;
      }),
    });

    await expect(service.onCreateNewDialog({})).resolves.toBeUndefined();
    expect(dialogs.markMemoryGroomed).not.toHaveBeenCalled();
  });

  test("serializes parallel events so one dialog is groomed once", async () => {
    let marked = false;
    let releaseGrooming: (() => void) | undefined;
    const groomingFinished = new Promise<void>((resolve) => {
      releaseGrooming = resolve;
    });
    const findLatest = vi.fn(async () => (marked ? null : { id: "dialog-1" }));
    const groom = vi.fn(async () => {
      await groomingFinished;
      return { response: "ok", toolCalls: [] };
    });
    const mark = vi.fn(async () => {
      marked = true;
    });
    const { service } = makeService({ findLatest, groom, mark });

    const first = service.onCreateNewDialog({});
    const second = service.onCreateNewDialog({});
    await vi.waitFor(() => expect(groom).toHaveBeenCalledTimes(1));

    releaseGrooming?.();
    await Promise.all([first, second]);

    expect(groom).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledTimes(1);
  });
});
