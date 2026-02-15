import { resolve } from "node:path";
import { Config } from "../config.js";
import { downloadRclone } from "../sources/rclone.js";
import { downloadCustom } from "../sources/custom.js";
import { Source } from "../sources/types.js";
import { extractContent } from "../extraction/index.js";
import { ensureDir, cleanupFile, tempDirForSource } from "../util.js";

async function downloadFile(
  source: Source,
  filePath: string,
  destDir: string
): Promise<string> {
  switch (source.provider) {
    case "rclone":
      return downloadRclone(source, filePath, destDir);
    case "custom":
      return downloadCustom(source, filePath, destDir);
  }
}

interface FetchResult {
  filename: string;
  extracted: boolean;
  content_type: string;
  text: string | null;
  local_path: string | null;
}

export async function fetchFile(
  config: Config,
  sourceName: string,
  filePath: string,
  keepLocal: boolean = false
): Promise<FetchResult> {
  const source = config.sources[sourceName];
  if (!source) {
    throw new Error(`Source "${sourceName}" not found in config`);
  }

  const destDir = tempDirForSource(config.settings.tempDir, sourceName);
  await ensureDir(destDir);

  const localPath = await downloadFile(source, filePath, destDir);
  const filename = filePath.split("/").pop() ?? filePath;

  const extraction = await extractContent(
    localPath,
    config.settings.maxContentLength
  );

  const shouldCleanup =
    config.settings.autoCleanup && !keepLocal && extraction.extracted;

  if (shouldCleanup) {
    await cleanupFile(localPath);
  }

  return {
    filename,
    extracted: extraction.extracted,
    content_type: extraction.contentType,
    text: extraction.text,
    local_path: shouldCleanup ? null : localPath,
  };
}
