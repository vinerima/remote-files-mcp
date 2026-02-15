import { readFile } from "node:fs/promises";

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml",
  ".log", ".ini", ".conf", ".cfg", ".toml", ".env",
  ".html", ".htm", ".css", ".js", ".ts", ".py", ".sh",
  ".rst", ".tex",
]);

export function isTextFile(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

export async function extractText(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}
