import { z } from "zod";

const WebOpenUrlSchema = z
  .string()
  .trim()
  .min(1, "url must be a non-empty string");
const WebOpenRenderSchema = z.enum(["auto", "http", "browser"]);
const WebOpenMaxCharsSchema = z.number().int().min(1000).max(200_000);

const WebOpenRequestSchema = z
  .object({
    url: WebOpenUrlSchema,
    render: WebOpenRenderSchema.optional(),
    max_chars: WebOpenMaxCharsSchema.optional(),
  })
  .strict();

const WebOpenToolRequestSchema = z
  .object({
    url: WebOpenUrlSchema,
    render: WebOpenRenderSchema.nullable(),
    max_chars: WebOpenMaxCharsSchema.nullable(),
  })
  .strict();

type WebOpenRequest = z.infer<typeof WebOpenRequestSchema>;

export { WebOpenRequestSchema, WebOpenToolRequestSchema };
export type { WebOpenRequest };
