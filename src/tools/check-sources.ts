import { Config } from "../config.js";
import { loadState, saveState, diffFiles, applyDiff } from "../state.js";
import { listRclone } from "../sources/rclone.js";
import { listCustom } from "../sources/custom.js";
import { Source, ListedFile } from "../sources/types.js";

async function listFiles(source: Source): Promise<ListedFile[]> {
  switch (source.provider) {
    case "rclone":
      return listRclone(source);
    case "custom":
      return listCustom(source);
  }
}

interface CheckResult {
  sources: Record<
    string,
    {
      new_files: Array<{ path: string; size: number }>;
      changed_files: Array<{ path: string; size: number }>;
      total_tracked: number;
      new_count: number;
      changed_count: number;
      error?: string;
    }
  >;
}

export async function checkSources(
  config: Config,
  sourceName?: string,
  includePattern?: string
): Promise<CheckResult> {
  const sourceNames = sourceName
    ? [sourceName]
    : Object.keys(config.sources);

  const result: CheckResult = { sources: {} };

  for (const name of sourceNames) {
    const source = config.sources[name];
    if (!source) {
      result.sources[name] = {
        new_files: [],
        changed_files: [],
        total_tracked: 0,
        new_count: 0,
        changed_count: 0,
        error: `Source "${name}" not found in config`,
      };
      continue;
    }

    try {
      let files = await listFiles(source);

      if (includePattern) {
        const regex = globToRegex(includePattern);
        files = files.filter((f) => regex.test(f.path));
      }

      const state = await loadState(config.settings.stateDir, name);
      const diff = diffFiles(files, state);

      const updatedState = applyDiff(state, name, files);
      await saveState(config.settings.stateDir, name, updatedState);

      result.sources[name] = {
        new_files: diff.newFiles.map((f) => ({ path: f.path, size: f.size })),
        changed_files: diff.changedFiles.map((f) => ({
          path: f.path,
          size: f.size,
        })),
        total_tracked: Object.keys(updatedState.files).length,
        new_count: diff.newFiles.length,
        changed_count: diff.changedFiles.length,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.sources[name] = {
        new_files: [],
        changed_files: [],
        total_tracked: 0,
        new_count: 0,
        changed_count: 0,
        error: msg,
      };
    }
  }

  return result;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(escaped, "i");
}
