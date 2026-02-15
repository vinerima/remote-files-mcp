import { Config } from "../config.js";
import { saveState, applyDiff } from "../state.js";
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

interface InitResult {
  source: string;
  files_tracked: number;
  initialized_at: string;
}

export async function initSource(
  config: Config,
  sourceName: string
): Promise<InitResult> {
  const source = config.sources[sourceName];
  if (!source) {
    throw new Error(`Source "${sourceName}" not found in config`);
  }

  const files = await listFiles(source);
  const state = applyDiff(null, sourceName, files);
  await saveState(config.settings.stateDir, sourceName, state);

  return {
    source: sourceName,
    files_tracked: Object.keys(state.files).length,
    initialized_at: state.initialized_at,
  };
}
