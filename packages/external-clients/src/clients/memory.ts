import { z } from "zod";

const DateTimeSchema = z.string().datetime({ offset: true });
const JsonObjectSchema = z.record(z.string(), z.unknown());

export const ErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: ErrorDetailSchema,
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const ReadyResponseSchema = z.object({
  ready: z.boolean(),
  vault: z.boolean(),
  sqlite: z.boolean(),
  embeddings: z.boolean(),
  embedding_error: z.string().nullable().optional(),
  git_initialized: z.boolean().nullable().optional(),
});

export const NoteCreateSchema = z.object({
  path: z.string(),
  title: z.string().nullable().optional(),
  content: z.string().default(""),
  frontmatter: JsonObjectSchema.default({}),
});

export const NoteUpdateSchema = z
  .object({
    path: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    frontmatter: JsonObjectSchema.nullable().optional(),
  })
  .strict();

export const NoteMutationResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
});

export const DeleteNoteResponseSchema = z.void();

export const NoteResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  content: z.string(),
  raw: z.string(),
  frontmatter: JsonObjectSchema,
  created: DateTimeSchema.nullable().optional(),
  updated: DateTimeSchema.nullable().optional(),
});

export const GitCommitSchema = z.object({
  commit: z.string(),
  timestamp: DateTimeSchema.nullable().optional(),
  author: z.string(),
  message: z.string(),
});

export const NoteHistoryResponseSchema = z.object({
  note_id: z.string(),
  history: z.array(GitCommitSchema),
});

export const RevisionResponseSchema = z.object({
  note_id: z.string(),
  revision: z.string(),
  path: z.string(),
  raw: z.string(),
});

export const RestoreRequestSchema = z.object({
  revision: z.string().min(1).max(200),
});

export const RestoreResponseSchema = z.object({
  id: z.string(),
  path: z.string(),
  revision: z.string(),
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  mode: z.enum(["keyword", "semantic", "hybrid"]).default("hybrid"),
  limit: z.number().int().min(1).max(100).nullable().optional(),
  path_prefix: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  expand_links: z.boolean().default(false),
});

export const SearchResultSchema = z.object({
  note_id: z.string(),
  path: z.string(),
  title: z.string(),
  heading_path: z.array(z.string()),
  content: z.string(),
  score: z.number(),
  keyword_score: z.number().nullable().optional(),
  semantic_score: z.number().nullable().optional(),
  chunk_id: z.string(),
});

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: z.string(),
  results: z.array(SearchResultSchema),
});

export const CheckpointRequestSchema = z.object({
  message: z.string().min(1).max(500),
});

export const GitInitResponseSchema = z.object({
  initialized: z.boolean(),
  path: z.string(),
});

export const GitStatusResponseSchema = z.object({
  initialized: z.boolean(),
  entries: z.array(z.string()),
});

export const GitDiffResponseSchema = z.object({
  diff: z.string(),
});

export const GitCheckpointResponseSchema = z.object({
  created: z.boolean(),
  commit: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
});

export const GitHistoryLimitSchema = z.number().int().default(50);

export const GitHistoryResponseSchema = z.object({
  history: z.array(GitCommitSchema),
});

export const ReconciliationDuplicateSchema = z.object({
  id: z.string(),
  paths: z.array(z.string()),
  indexed_path: z.string().nullable().optional(),
});

export const ReindexResponseSchema = z.object({
  reindexed: z.boolean(),
  indexed: z.number().int(),
  deleted: z.number().int(),
  duplicates: z.array(ReconciliationDuplicateSchema).default([]),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;
export type NoteCreate = z.infer<typeof NoteCreateSchema>;
export type NoteUpdate = z.infer<typeof NoteUpdateSchema>;
export type NoteMutationResponse = z.infer<typeof NoteMutationResponseSchema>;
export type DeleteNoteResponse = z.infer<typeof DeleteNoteResponseSchema>;
export type NoteResponse = z.infer<typeof NoteResponseSchema>;
export type GitCommit = z.infer<typeof GitCommitSchema>;
export type NoteHistoryResponse = z.infer<typeof NoteHistoryResponseSchema>;
export type RevisionResponse = z.infer<typeof RevisionResponseSchema>;
export type RestoreRequest = z.infer<typeof RestoreRequestSchema>;
export type RestoreResponse = z.infer<typeof RestoreResponseSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type CheckpointRequest = z.infer<typeof CheckpointRequestSchema>;
export type GitInitResponse = z.infer<typeof GitInitResponseSchema>;
export type GitStatusResponse = z.infer<typeof GitStatusResponseSchema>;
export type GitDiffResponse = z.infer<typeof GitDiffResponseSchema>;
export type GitCheckpointResponse = z.infer<typeof GitCheckpointResponseSchema>;
export type GitHistoryLimit = z.infer<typeof GitHistoryLimitSchema>;
export type GitHistoryResponse = z.infer<typeof GitHistoryResponseSchema>;
export type ReconciliationDuplicate = z.infer<typeof ReconciliationDuplicateSchema>;
export type ReindexResponse = z.infer<typeof ReindexResponseSchema>;

type FetchMethod = "DELETE" | "GET" | "POST" | "PUT";

interface MemoryClientErrorOptions {
  endpoint: string;
  status?: number;
  payload?: unknown;
  errorResponse?: ErrorResponse;
  cause?: unknown;
}

export class MemoryClientError extends Error {
  readonly endpoint: string;
  readonly status?: number;
  readonly payload?: unknown;
  readonly errorResponse?: ErrorResponse;

  constructor(message: string, options: MemoryClientErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "MemoryClientError";
    this.endpoint = options.endpoint;
    if (options.status !== undefined) this.status = options.status;
    if (options.payload !== undefined) this.payload = options.payload;
    if (options.errorResponse !== undefined) this.errorResponse = options.errorResponse;
  }
}

type ResponseSchema<T> = z.ZodType<T>;

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  try {
    return await response.json();
  } catch {
    if (typeof response.text === "function") {
      try {
        const text = await response.text();
        if (text.length === 0) return undefined;
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export class MemoryClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  health(): Promise<HealthResponse> {
    return this.request("/health", "GET", HealthResponseSchema);
  }

  ready(): Promise<ReadyResponse> {
    return this.request("/ready", "GET", ReadyResponseSchema);
  }

  createNote(payload: z.input<typeof NoteCreateSchema>): Promise<NoteMutationResponse> {
    return this.request("/v1/notes", "POST", NoteMutationResponseSchema, NoteCreateSchema.parse(payload));
  }

  getNote(noteId: string): Promise<NoteResponse> {
    return this.request(`/v1/notes/${encodeURIComponent(noteId)}`, "GET", NoteResponseSchema);
  }

  updateNote(noteId: string, payload: NoteUpdate): Promise<NoteMutationResponse> {
    return this.request(
      `/v1/notes/${encodeURIComponent(noteId)}`,
      "PUT",
      NoteMutationResponseSchema,
      NoteUpdateSchema.parse(payload),
    );
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.request(
      `/v1/notes/${encodeURIComponent(noteId)}`,
      "DELETE",
      DeleteNoteResponseSchema,
    );
  }

  getNoteHistory(noteId: string): Promise<NoteHistoryResponse> {
    return this.request(
      `/v1/notes/${encodeURIComponent(noteId)}/history`,
      "GET",
      NoteHistoryResponseSchema,
    );
  }

  getRevision(noteId: string, revision: string): Promise<RevisionResponse> {
    return this.request(
      `/v1/notes/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revision)}`,
      "GET",
      RevisionResponseSchema,
    );
  }

  restoreNote(noteId: string, payload: RestoreRequest): Promise<RestoreResponse> {
    return this.request(
      `/v1/notes/${encodeURIComponent(noteId)}/restore`,
      "POST",
      RestoreResponseSchema,
      RestoreRequestSchema.parse(payload),
    );
  }

  search(payload: z.input<typeof SearchRequestSchema>): Promise<SearchResponse> {
    return this.request("/v1/search", "POST", SearchResponseSchema, SearchRequestSchema.parse(payload));
  }

  initGit(): Promise<GitInitResponse> {
    return this.request("/v1/git/init", "POST", GitInitResponseSchema);
  }

  getGitStatus(): Promise<GitStatusResponse> {
    return this.request("/v1/git/status", "GET", GitStatusResponseSchema);
  }

  getGitDiff(): Promise<GitDiffResponse> {
    return this.request("/v1/git/diff", "GET", GitDiffResponseSchema);
  }

  createCheckpoint(payload: CheckpointRequest): Promise<GitCheckpointResponse> {
    return this.request(
      "/v1/git/checkpoint",
      "POST",
      GitCheckpointResponseSchema,
      CheckpointRequestSchema.parse(payload),
    );
  }

  getGitHistory(limit?: GitHistoryLimit): Promise<GitHistoryResponse> {
    const resolvedLimit = GitHistoryLimitSchema.parse(limit);
    return this.request(
      `/v1/git/history?limit=${encodeURIComponent(String(resolvedLimit))}`,
      "GET",
      GitHistoryResponseSchema,
    );
  }

  reindex(): Promise<ReindexResponse> {
    return this.request("/v1/admin/reindex", "POST", ReindexResponseSchema);
  }

  private async request<T>(
    path: string,
    method: FetchMethod,
    schema: ResponseSchema<T> | undefined,
    body?: unknown,
  ): Promise<T> {
    const endpoint = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (method === "POST" || method === "PUT") {
      headers["content-type"] = "application/json";
    }

    const init: RequestInit = { method };
    if (Object.keys(headers).length > 0) init.headers = headers;
    if (body !== undefined) init.body = JSON.stringify(body);

    let response: Response;
    try {
      response = await globalThis.fetch(endpoint, init);
    } catch (cause) {
      throw new MemoryClientError(`${endpoint} request failed`, { endpoint, cause });
    }

    const payload = await readPayload(response);
    const ok = response.ok ?? (response.status >= 200 && response.status < 300);
    if (!ok) {
      const parsedError = ErrorResponseSchema.safeParse(payload);
      const errorResponse = parsedError.success ? parsedError.data : undefined;
      const message = errorResponse?.error.message ?? `${endpoint} failed with status ${response.status}`;
      const errorOptions: MemoryClientErrorOptions = {
        endpoint,
        status: response.status,
        payload,
      };
      if (errorResponse !== undefined) errorOptions.errorResponse = errorResponse;
      throw new MemoryClientError(message, errorOptions);
    }

    if (schema === undefined) return undefined as T;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new MemoryClientError(`${endpoint} returned an invalid response payload`, {
        endpoint,
        status: response.status,
        payload,
        cause: parsed.error,
      });
    }
    return parsed.data;
  }
}
