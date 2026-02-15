import { exec } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function shellExec(command: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    exec(command, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: error?.code ?? 0,
      });
    });
  });
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    // ignore cleanup failures
  }
}

export function tempDirForSource(tempDir: string, sourceName: string): string {
  return resolve(tempDir, sourceName);
}
