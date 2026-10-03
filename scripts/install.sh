#!/usr/bin/env bash
#
# install.sh - Install Glowsnap into a user/prefix desktop environment.
#
# Installs the built binary, the .desktop entry and the hicolor icon theme so
# that desktop environments (KDE Plasma, GNOME, ...) show the correct icon in
# the taskbar and application launcher, and associate the running window with
# the glowsnap.desktop entry.
#
# It only installs files - it never touches or clears icon caches. If newly
# installed icons are not picked up, refresh the icon cache manually, e.g.:
#   gtk-update-icon-cache -f ~/.local/share/icons/hicolor
# or log out and back in.
#
# Environment:
#   PREFIX    Install prefix (default: ~/.local). Use /usr/local with sudo to
#             make the app available system-wide.
#
# Usage:
#   ./scripts/build.sh
#   ./scripts/install.sh
#   sudo PREFIX=/usr/local ./scripts/install.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="glowsnap"
PREFIX="${PREFIX:-$HOME/.local}"

if [ ! -f "build/bin/$APP_NAME" ]; then
    echo "ERROR: build/bin/$APP_NAME not found. Run ./scripts/build.sh first." >&2
    exit 1
fi
if [ ! -f "build/glowsnap.desktop" ]; then
    echo "ERROR: build/glowsnap.desktop not found." >&2
    exit 1
fi
if [ ! -d "build/icons/hicolor" ]; then
    echo "ERROR: build/icons/hicolor not found." >&2
    exit 1
fi

BINDIR="$PREFIX/bin"
APPSDIR="$PREFIX/share/applications"
ICONDIR="$PREFIX/share/icons"

mkdir -p "$BINDIR" "$APPSDIR" "$ICONDIR"

install -Dm755 "build/bin/$APP_NAME" "$BINDIR/$APP_NAME"
install -Dm644 "build/glowsnap.desktop" "$APPSDIR/glowsnap.desktop"
cp -r "build/icons/hicolor/." "$ICONDIR/hicolor/"

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICONDIR/hicolor" >/dev/null 2>&1 || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APPSDIR" >/dev/null 2>&1 || true
fi

echo "Installed Glowsnap to $PREFIX:"
echo "  $BINDIR/$APP_NAME"
echo "  $APPSDIR/glowsnap.desktop"
echo "  $ICONDIR/hicolor/*/apps/glowsnap.png"
echo