-- CreateTable
CREATE TABLE "dialogs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dialogs_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dialogId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "tools" JSONB,
    "sources" JSONB,
    "metrics" JSONB,
    CONSTRAINT "dialogs_messages_dialogId_fkey" FOREIGN KEY ("dialogId") REFERENCES "dialogs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "dialogs_messages_dialogId_createdAt_idx" ON "dialogs_messages"("dialogId", "createdAt");
