import { z } from "zod";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { SourceSchema } from "./sources/types.js";

const SettingsSchema = z.object({
  tempDir: z.string().default("/tmp/remote-files"),
  stateDir: z.string().default("~/.local/share/remote-files/state"),
  autoCleanup: z.boolean().default(true),
  maxContentLength: z.number().default(102400),
});

const ConfigSchema = z.object({
  sources: z.record(z.string(), SourceSchema),
  settings: SettingsSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}

export function resolveSettings(settings: Settings): Settings {
  return {
    ...settings,
    tempDir: expandHome(settings.tempDir),
    stateDir: expandHome(settings.stateDir),
  };
}

export async function loadConfig(): Promise<Config> {
  const candidates = [
    process.env.REMOTE_FILES_CONFIG,
    resolve(homedir(), ".config/remote-files/config.json"),
    resolve(process.cwd(), "remote-files.json"),
  ].filter((p): p is string => p !== undefined);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const raw = await readFile(candidate, "utf-8");
      const parsed = JSON.parse(raw);
      const config = ConfigSchema.parse(parsed);
      config.settings = resolveSettings(config.settings);
      return config;
    }
  }

  throw new Error(
    `No config file found. Looked in:\n${candidates.map((c) => `  - ${c}`).join("\n")}\n\nCreate a config file or set REMOTE_FILES_CONFIG env var.`
  );
}
