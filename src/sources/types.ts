import { z } from "zod";

export const RcloneSourceSchema = z.object({
  provider: z.literal("rclone"),
  description: z.string().optional(),
  remote: z.string(),
  path: z.string(),
  flags: z.array(z.string()).default([]),
  exclude: z.array(z.string()).default([]),
  excludeFrom: z.string().optional(),
});

export const CustomSourceSchema = z.object({
  provider: z.literal("custom"),
  description: z.string().optional(),
  listCommand: z.string(),
  downloadCommand: z.string(),
});

export const SourceSchema = z.discriminatedUnion("provider", [
  RcloneSourceSchema,
  CustomSourceSchema,
]);

export type RcloneSource = z.infer<typeof RcloneSourceSchema>;
export type CustomSource = z.infer<typeof CustomSourceSchema>;
export type Source = z.infer<typeof SourceSchema>;

export interface ListedFile {
  path: string;
  size: number;
}

export interface SourceProvider {
  list(source: Source): Promise<ListedFile[]>;
  download(source: Source, filePath: string, destDir: string): Promise<string>;
}
