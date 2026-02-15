# remote-files

MCP server for monitoring remote file sources, detecting new files, and extracting content. Works with any storage backend via rclone (70+ providers) or custom commands.

## Features

- **Multi-source monitoring** — track multiple remote locations (Google Drive, S3, SFTP, local dirs, etc.)
- **New file detection** — state-based diffing detects new and changed files
- **Content extraction** — extracts text from DOCX, PDF, and plain text files
- **Auto-cleanup** — downloaded files are deleted after content extraction
- **Hybrid transport** — built-in rclone support + custom shell commands

## Installation

```bash
# Build
cd remote-files
npm install
npm run build

# Add to Claude Code
claude mcp add --transport stdio remote-files -- node /absolute/path/to/remote-files/dist/index.js
```

## Configuration

Create `~/.config/remote-files/config.json`:

```json
{
  "sources": {
    "my-drive": {
      "provider": "rclone",
      "remote": "gdrive:",
      "path": "Documents/Reports",
      "flags": ["--drive-shared-with-me"],
      "exclude": ["*.tmp"],
      "excludeFrom": "/path/to/exclude-patterns.txt"
    },
    "my-server": {
      "provider": "custom",
      "listCommand": "ssh server 'find /data -type f -printf \"%s %P\\n\"'",
      "downloadCommand": "scp server:/data/$FILE $DEST/"
    }
  },
  "settings": {
    "tempDir": "/tmp/remote-files",
    "stateDir": "~/.local/share/remote-files/state",
    "autoCleanup": true,
    "maxContentLength": 102400
  }
}
```

Override config path with `REMOTE_FILES_CONFIG` env var.

### rclone provider

Requires [rclone](https://rclone.org/) installed and configured. Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `remote` | yes | rclone remote name (e.g. `gdrive:`, `s3:`) |
| `path` | yes | Path within the remote |
| `flags` | no | Extra rclone flags |
| `exclude` | no | Exclude patterns |
| `excludeFrom` | no | Path to exclude file |

### custom provider

For any backend not covered by rclone. Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `listCommand` | yes | Shell command that outputs `<size> <path>` lines |
| `downloadCommand` | yes | Shell command with `$FILE` and `$DEST` variables |

## MCP Tools

### check_sources

Check for new/changed files without downloading.

```
Parameters:
  source?          — specific source name (omit for all)
  include_pattern? — glob filter (e.g. "*.docx")
```

### init_source

Initialize a source baseline. All current files are marked as known.

```
Parameters:
  source — source name to initialize
```

### fetch_file

Download a file, extract text, and auto-delete the local copy.

```
Parameters:
  source     — source name
  path       — file path (from check_sources)
  keep_local — if true, keep file on disk (default: false)
```

Returns extracted text for DOCX/PDF/TXT. For unknown formats, returns `local_path` for Claude to read directly.

## Workflow

1. **First time:** Claude calls `init_source` to create a baseline
2. **Ongoing:** Claude calls `check_sources` to find new files
3. **Per file:** Claude calls `fetch_file` to get content and summarize
4. Files are auto-deleted after extraction

## Example: Migrating from baugruppe sync

Replace `sync.sh` + `track_files.py` with this config:

```json
{
  "sources": {
    "baugruppe": {
      "provider": "rclone",
      "remote": "baugruppe:",
      "path": "Wohnprojekt_Nordwest/01_Protokolle-ALLE",
      "flags": ["--drive-shared-with-me"],
      "excludeFrom": "~/.config/rclone/baugruppe-exclude.txt"
    }
  }
}
```

Then use the MCP tools instead of running shell scripts.
