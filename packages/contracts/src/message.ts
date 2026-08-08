import { z } from "zod";

const MessageSchema = z.object({
  actor: z.enum(["user", "agent"]),
  type: z.literal(["completion", "user"]),
  content: z.string(),
  createdAt: z.date(),
});

type Message = z.infer<typeof MessageSchema>;

export { MessageSchema };
export type { Message };
