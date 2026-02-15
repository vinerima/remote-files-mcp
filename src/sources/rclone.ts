import { RcloneSource, ListedFile } from "./types.js";
import { shellExec } from "../util.js";

export function buildListCommand(source: RcloneSource): string {
  const parts = ["rclone", "ls", `"${source.remote}${source.path}"`];

  for (const flag of source.flags) {
    parts.push(flag);
  }

  for (const pattern of source.exclude) {
    parts.push(`--exclude "${pattern}"`);
  }

  if (source.excludeFrom) {
    parts.push(`--exclude-from "${source.excludeFrom}"`);
  }

  return parts.join(" ");
}

export function buildDownloadCommand(
  source: RcloneSource,
  filePath: string,
  destDir: string
): string {
  const remotePath = `${source.remote}${source.path}/${filePath}`;
  const parts = [
    "rclone",
    "copy",
    `"${remotePath}"`,
    `"${destDir}"`,
  ];

  for (const flag of source.flags) {
    parts.push(flag);
  }

  return parts.join(" ");
}

export function parseRcloneOutput(output: string): ListedFile[] {
  const files: ListedFile[] = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\s*(\d+)\s+(.+)$/);
    if (match) {
      files.push({
        size: parseInt(match[1], 10),
        path: match[2],
      });
    }
  }
  return files;
}

export async function listRclone(source: RcloneSource): Promise<ListedFile[]> {
  const cmd = buildListCommand(source);
  const result = await shellExec(cmd);
  if (result.exitCode !== 0) {
    throw new Error(`rclone ls failed (exit ${result.exitCode}): ${result.stderr}`);
  }
  return parseRcloneOutput(result.stdout);
}

export async function downloadRclone(
  source: RcloneSource,
  filePath: string,
  destDir: string
): Promise<string> {
  const cmd = buildDownloadCommand(source, filePath, destDir);
  const result = await shellExec(cmd);
  if (result.exitCode !== 0) {
    throw new Error(`rclone copy failed (exit ${result.exitCode}): ${result.stderr}`);
  }
  const filename = filePath.split("/").pop()!;
  return `${destDir}/${filename}`;
}
