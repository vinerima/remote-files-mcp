#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${HOME}/.config/remote-files"
CONFIG_FILE="${CONFIG_DIR}/config.json"
DIST_ENTRY="${SCRIPT_DIR}/dist/index.js"

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
step()  { echo -e "\n${BOLD}$1${NC}"; }

echo -e "${BOLD}remote-files MCP Server Installer${NC}"
echo "─────────────────────────────────"

# ── Check prerequisites ──

step "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Install it from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js >= 18 required (found $(node -v))"
  exit 1
fi
info "Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
  error "npm is not installed"
  exit 1
fi
info "npm $(npm -v)"

if command -v claude &>/dev/null; then
  info "Claude Code CLI found"
  HAS_CLAUDE=true
else
  warn "Claude Code CLI not found — will skip MCP registration"
  HAS_CLAUDE=false
fi

# ── Choose transport mode ──

step "Transport mode"
echo ""
echo "  remote-files supports two transport modes:"
echo ""
echo -e "    ${BOLD}1) rclone${NC} (recommended)"
echo "       Universal backend supporting 70+ cloud providers,"
echo "       local filesystem, SFTP, FTP, HTTP, WebDAV, and more."
echo "       Will be installed automatically if not present."
echo ""
echo -e "    ${BOLD}2) custom${NC}"
echo "       You provide your own shell commands for listing and"
echo "       downloading files (e.g. ssh+scp, aws cli, curl, rsync)."
echo "       No additional software is installed."
echo ""

while true; do
  read -rp "  Choose transport mode [1/2] (default: 1): " TRANSPORT_CHOICE
  TRANSPORT_CHOICE="${TRANSPORT_CHOICE:-1}"
  case "$TRANSPORT_CHOICE" in
    1) TRANSPORT_MODE="rclone"; break ;;
    2) TRANSPORT_MODE="custom"; break ;;
    *) echo "  Please enter 1 or 2." ;;
  esac
done

info "Selected: ${TRANSPORT_MODE}"

# ── Install rclone if needed ──

if [ "$TRANSPORT_MODE" = "rclone" ]; then
  step "Checking rclone..."

  if command -v rclone &>/dev/null; then
    info "rclone already installed: $(rclone --version 2>&1 | head -1)"
  else
    warn "rclone not found — installing..."
    echo ""

    # Detect platform for install method
    if command -v apt-get &>/dev/null; then
      # Debian/Ubuntu/Raspberry Pi
      echo "  Detected apt-based system"
      read -rp "  Install rclone via apt? [Y/n]: " RCLONE_CONFIRM
      RCLONE_CONFIRM="${RCLONE_CONFIRM:-Y}"
      if [[ "$RCLONE_CONFIRM" =~ ^[Yy] ]]; then
        sudo apt-get update -qq && sudo apt-get install -y -qq rclone
        info "rclone installed via apt"
      else
        error "rclone is required for rclone transport mode"
        exit 1
      fi
    elif command -v brew &>/dev/null; then
      # macOS with Homebrew
      echo "  Detected Homebrew"
      read -rp "  Install rclone via brew? [Y/n]: " RCLONE_CONFIRM
      RCLONE_CONFIRM="${RCLONE_CONFIRM:-Y}"
      if [[ "$RCLONE_CONFIRM" =~ ^[Yy] ]]; then
        brew install rclone
        info "rclone installed via brew"
      else
        error "rclone is required for rclone transport mode"
        exit 1
      fi
    elif command -v pacman &>/dev/null; then
      # Arch
      echo "  Detected pacman"
      read -rp "  Install rclone via pacman? [Y/n]: " RCLONE_CONFIRM
      RCLONE_CONFIRM="${RCLONE_CONFIRM:-Y}"
      if [[ "$RCLONE_CONFIRM" =~ ^[Yy] ]]; then
        sudo pacman -S --noconfirm rclone
        info "rclone installed via pacman"
      else
        error "rclone is required for rclone transport mode"
        exit 1
      fi
    else
      # Fallback: official install script
      echo "  No supported package manager detected"
      echo "  Will use the official rclone install script (https://rclone.org/install.sh)"
      read -rp "  Proceed? [Y/n]: " RCLONE_CONFIRM
      RCLONE_CONFIRM="${RCLONE_CONFIRM:-Y}"
      if [[ "$RCLONE_CONFIRM" =~ ^[Yy] ]]; then
        curl -fsSL https://rclone.org/install.sh | sudo bash
        info "rclone installed via official script"
      else
        error "rclone is required for rclone transport mode"
        exit 1
      fi
    fi

    # Verify
    if ! command -v rclone &>/dev/null; then
      error "rclone installation failed"
      exit 1
    fi
    info "rclone ready: $(rclone --version 2>&1 | head -1)"
  fi

  # ── Configure an rclone remote ──

  step "Configuring rclone remote..."

  # Check for existing remotes
  EXISTING_REMOTES=$(rclone listremotes 2>/dev/null || true)

  if [ -n "$EXISTING_REMOTES" ]; then
    echo ""
    echo "  Existing rclone remotes:"
    echo "$EXISTING_REMOTES" | sed 's/^/    /'
    echo ""
    echo "  You can use an existing remote or create a new one."
    echo ""
    read -rp "  Create a new remote? [y/N]: " CREATE_REMOTE
    CREATE_REMOTE="${CREATE_REMOTE:-N}"
  else
    echo ""
    echo "  No rclone remotes configured yet."
    echo ""
    read -rp "  Configure a remote now? [Y/n]: " CREATE_REMOTE
    CREATE_REMOTE="${CREATE_REMOTE:-Y}"
  fi

  if [[ "$CREATE_REMOTE" =~ ^[Yy] ]]; then
    echo ""
    info "Launching rclone config — follow the prompts to set up your remote."
    echo "  When done, select 'q' to quit rclone config and return here."
    echo ""
    rclone config
    echo ""
    info "Back to remote-files installer"
  fi

  # ── Pick which remote + path to use ──

  AVAILABLE_REMOTES=$(rclone listremotes 2>/dev/null || true)

  if [ -n "$AVAILABLE_REMOTES" ]; then
    REMOTE_COUNT=$(echo "$AVAILABLE_REMOTES" | wc -l)

    if [ "$REMOTE_COUNT" -eq 1 ]; then
      CHOSEN_REMOTE="$AVAILABLE_REMOTES"
      info "Using remote: ${CHOSEN_REMOTE}"
    else
      echo ""
      echo "  Available remotes:"
      echo "$AVAILABLE_REMOTES" | nl -ba -s ') ' | sed 's/^/  /'
      echo ""
      while true; do
        read -rp "  Select a remote (number or name): " REMOTE_PICK
        # Check if it's a number
        if [[ "$REMOTE_PICK" =~ ^[0-9]+$ ]]; then
          CHOSEN_REMOTE=$(echo "$AVAILABLE_REMOTES" | sed -n "${REMOTE_PICK}p")
        else
          # Normalize: ensure trailing colon
          CHOSEN_REMOTE="${REMOTE_PICK%:}:"
        fi
        if echo "$AVAILABLE_REMOTES" | grep -qF "$CHOSEN_REMOTE"; then
          break
        else
          echo "  Remote not found. Try again."
        fi
      done
      info "Using remote: ${CHOSEN_REMOTE}"
    fi

    echo ""
    read -rp "  Path within the remote (e.g. Documents/Reports, or leave empty for root): " REMOTE_PATH
    REMOTE_PATH="${REMOTE_PATH%/}"  # strip trailing slash

    # Ask for a source name
    DEFAULT_SOURCE_NAME=$(echo "$CHOSEN_REMOTE" | tr -d ':' | tr '[:upper:]' '[:lower:]')
    read -rp "  Source name for this config [${DEFAULT_SOURCE_NAME}]: " SOURCE_NAME
    SOURCE_NAME="${SOURCE_NAME:-$DEFAULT_SOURCE_NAME}"

    RCLONE_CONFIGURED=true
    if [ -n "$REMOTE_PATH" ]; then
      info "Will configure source '${SOURCE_NAME}' → ${CHOSEN_REMOTE}${REMOTE_PATH}"
    else
      info "Will configure source '${SOURCE_NAME}' → ${CHOSEN_REMOTE} (root)"
    fi
  else
    warn "No rclone remotes available — config will use placeholder values"
    RCLONE_CONFIGURED=false
  fi
fi

# ── Install dependencies ──

step "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --production=false 2>&1 | tail -1
info "Dependencies installed"

# ── Build ──

step "Building..."
npx tsc 2>&1
info "Build complete → ${DIST_ENTRY}"

# ── Create config template ──

step "Setting up configuration..."

if [ -f "$CONFIG_FILE" ]; then
  info "Config already exists at ${CONFIG_FILE}"
else
  mkdir -p "$CONFIG_DIR"

  if [ "$TRANSPORT_MODE" = "rclone" ] && [ "${RCLONE_CONFIGURED:-false}" = true ]; then
    cat > "$CONFIG_FILE" <<CONF
{
  "sources": {
    "${SOURCE_NAME}": {
      "provider": "rclone",
      "remote": "${CHOSEN_REMOTE}",
      "path": "${REMOTE_PATH}",
      "flags": [],
      "exclude": []
    }
  },
  "settings": {
    "tempDir": "/tmp/remote-files",
    "stateDir": "~/.local/share/remote-files/state",
    "autoCleanup": true,
    "maxContentLength": 102400
  }
}
CONF
    info "Created config at ${CONFIG_FILE}"
    if [ -n "$REMOTE_PATH" ]; then
      info "Source '${SOURCE_NAME}' → ${CHOSEN_REMOTE}${REMOTE_PATH}"
    else
      info "Source '${SOURCE_NAME}' → ${CHOSEN_REMOTE} (root)"
    fi
  elif [ "$TRANSPORT_MODE" = "rclone" ]; then
    cat > "$CONFIG_FILE" <<'CONF'
{
  "sources": {
    "example": {
      "provider": "rclone",
      "description": "Edit this — set remote + path to match your rclone config",
      "remote": "myremote:",
      "path": "path/to/folder",
      "flags": [],
      "exclude": []
    }
  },
  "settings": {
    "tempDir": "/tmp/remote-files",
    "stateDir": "~/.local/share/remote-files/state",
    "autoCleanup": true,
    "maxContentLength": 102400
  }
}
CONF
    info "Created config template at ${CONFIG_FILE}"
    warn "Edit this file to add your rclone remote before using the server"
  else
    cat > "$CONFIG_FILE" <<'CONF'
{
  "sources": {
    "example": {
      "provider": "custom",
      "description": "Edit this — set your own list and download commands",
      "listCommand": "echo '1024 example.txt'",
      "downloadCommand": "cp /path/to/source/$FILE $DEST/"
    }
  },
  "settings": {
    "tempDir": "/tmp/remote-files",
    "stateDir": "~/.local/share/remote-files/state",
    "autoCleanup": true,
    "maxContentLength": 102400
  }
}
CONF
    info "Created config template at ${CONFIG_FILE}"
    warn "Edit this file to set your list/download commands before using the server"
  fi
fi

# ── Register with Claude Code ──

step "Registering MCP server..."

if [ "$HAS_CLAUDE" = true ] && [ -z "${CLAUDECODE:-}" ]; then
  # Remove existing registration if present, ignore errors
  claude mcp remove remote-files 2>/dev/null || true
  claude mcp add --transport stdio remote-files -- node "$DIST_ENTRY"
  info "Registered as 'remote-files' MCP server"
else
  if [ -n "${CLAUDECODE:-}" ]; then
    warn "Running inside Claude Code — cannot register MCP server from here"
  else
    warn "Claude Code CLI not found"
  fi
  echo "  Register manually by running:"
  echo "  claude mcp add --transport stdio remote-files -- node ${DIST_ENTRY}"
fi

# ── Done ──

step "Installation complete!"
echo ""
echo "  Config:  ${CONFIG_FILE}"
echo "  Server:  ${DIST_ENTRY}"
echo ""

if [ "$TRANSPORT_MODE" = "rclone" ] && [ "${RCLONE_CONFIGURED:-false}" = true ]; then
  echo "  Next steps:"
  echo "    1. Start a Claude Code session"
  echo "    2. Ask Claude to run init_source for '${SOURCE_NAME}'"
  echo "    3. Then use check_sources and fetch_file"
else
  echo "  Next steps:"
  echo "    1. Edit ${CONFIG_FILE} to configure your sources"
  echo "    2. Start a Claude Code session"
  echo "    3. Ask Claude to run init_source for your source"
  echo "    4. Then use check_sources and fetch_file"
fi
echo ""

# ── Uninstall hint ──

echo -e "  ${BOLD}To uninstall:${NC}"
echo "    claude mcp remove remote-files"
echo "    rm -rf ${CONFIG_DIR}"
echo "    rm -rf ~/.local/share/remote-files"
