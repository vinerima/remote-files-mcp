#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, Config } from "./config.js";
import { checkSources } from "./tools/check-sources.js";
import { initSource } from "./tools/init-source.js";
import { fetchFile } from "./tools/fetch-file.js";

let config: Config;

const server = new McpServer({
  name: "remote-files",
  version: "0.1.0",
});

server.tool(
  "check_sources",
  "Check configured remote sources for new or changed files since the last check. Returns a list of new/changed file paths without downloading anything.",
  {
    source: z
      .string()
      .optional()
      .describe("Name of a specific source to check. Omit to check all configured sources."),
    include_pattern: z
      .string()
      .optional()
      .describe('Glob pattern to filter files (e.g. "*.docx", "reports/*")'),
  },
  async ({ source, include_pattern }) => {
    const result = await checkSources(config, source, include_pattern);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "init_source",
  "Initialize a source by snapshotting all current remote files as known. No files are downloaded. Use this for first-time setup so that only future files are detected as new.",
  {
    source: z
      .string()
      .describe("Name of the source to initialize (must exist in config)"),
  },
  async ({ source }) => {
    const result = await initSource(config, source);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "fetch_file",
  "Download a single file from a remote source, extract its text content (DOCX, PDF, TXT, etc.), and return it. The local file is automatically deleted after extraction. For non-extractable formats, the file is kept on disk and its path is returned.",
  {
    source: z
      .string()
      .describe("Name of the source to fetch from"),
    path: z
      .string()
      .describe("File path within the source (as returned by check_sources)"),
    keep_local: z
      .boolean()
      .default(false)
      .describe("If true, do not delete the local copy after extraction"),
  },
  async ({ source, path, keep_local }) => {
    const result = await fetchFile(config, source, path, keep_local);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  try {
    config = await loadConfig();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[remote-files] Config error: ${msg}`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("[remote-files] Fatal error:", error);
  process.exit(1);
});
