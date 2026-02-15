import { CustomSource, ListedFile } from "./types.js";
import { shellExec } from "../util.js";

export function substituteVars(
  command: string,
  vars: Record<string, string>
): string {
  let result = command;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`$${key}`, value);
  }
  return result;
}

export function parseListOutput(output: string): ListedFile[] {
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

export async function listCustom(source: CustomSource): Promise<ListedFile[]> {
  const result = await shellExec(source.listCommand);
  if (result.exitCode !== 0) {
    throw new Error(
      `Custom list command failed (exit ${result.exitCode}): ${result.stderr}`
    );
  }
  return parseListOutput(result.stdout);
}

export async function downloadCustom(
  source: CustomSource,
  filePath: string,
  destDir: string
): Promise<string> {
  const cmd = substituteVars(source.downloadCommand, {
    FILE: filePath,
    DEST: destDir,
  });
  const result = await shellExec(cmd);
  if (result.exitCode !== 0) {
    throw new Error(
      `Custom download command failed (exit ${result.exitCode}): ${result.stderr}`
    );
  }
  const filename = filePath.split("/").pop()!;
  return `${destDir}/${filename}`;
}
