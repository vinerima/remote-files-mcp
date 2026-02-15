import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ListedFile } from "./sources/types.js";

export interface FileEntry {
  size: number;
  first_seen: string;
}

export interface SourceState {
  source: string;
  initialized_at: string;
  last_checked: string;
  files: Record<string, FileEntry>;
}

export interface DiffResult {
  newFiles: ListedFile[];
  changedFiles: ListedFile[];
  totalTracked: number;
}

function statePath(stateDir: string, sourceName: string): string {
  return resolve(stateDir, `${sourceName}.json`);
}

export async function loadState(
  stateDir: string,
  sourceName: string
): Promise<SourceState | null> {
  const path = statePath(stateDir, sourceName);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as SourceState;
}

export async function saveState(
  stateDir: string,
  sourceName: string,
  state: SourceState
): Promise<void> {
  const path = statePath(stateDir, sourceName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf-8");
}

export function diffFiles(
  currentFiles: ListedFile[],
  state: SourceState | null
): DiffResult {
  const known = state?.files ?? {};

  const newFiles: ListedFile[] = [];
  const changedFiles: ListedFile[] = [];

  for (const file of currentFiles) {
    const existing = known[file.path];
    if (!existing) {
      newFiles.push(file);
    } else if (existing.size !== file.size) {
      changedFiles.push(file);
    }
  }

  return {
    newFiles,
    changedFiles,
    totalTracked: Object.keys(known).length,
  };
}

export function applyDiff(
  state: SourceState | null,
  sourceName: string,
  currentFiles: ListedFile[]
): SourceState {
  const now = new Date().toISOString();
  const existingFiles = state?.files ?? {};

  const updatedFiles: Record<string, FileEntry> = {};
  for (const file of currentFiles) {
    const existing = existingFiles[file.path];
    updatedFiles[file.path] = {
      size: file.size,
      first_seen: existing?.first_seen ?? now,
    };
  }

  return {
    source: sourceName,
    initialized_at: state?.initialized_at ?? now,
    last_checked: now,
    files: updatedFiles,
  };
}
