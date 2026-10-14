#!/usr/bin/env bash
# sessions.sh — kitty sessions + Hyprland layouts as a standalone rofi picker.
#
# Deliberately NOT added to the `modi:` list in monokai-spotlight.rasi: this is
# its own launcher on SUPER+ALT+Return, so it doesn't add a fifth tab to the
# main rofi. Wired into hyprland.conf as:
#   rofi -show sessions -modes sessions:~/.config/rofi/scripts/sessions.sh
#
# Rofi calls this with no args to populate the list, then again with the chosen
# row as $1 to act on it — same contract as commands.sh.

declare -A commands

# --- kitty sessions (auto-discovered) --------------------------------------
# Any session file dropped in the dir below appears here with no edit to this
# script. Save new ones with ctrl+shift+alt+s (type a BARE NAME at the prompt).
# Extensions match kitty's own SESSION_FILE_EXTENSIONS set.
#
# Launching a FRESH kitty with --session, rather than goto_session inside a
# running window, is what avoids the leftover empty first tab.
session_dir="$HOME/.config/kitty/sessions"
shopt -s nullglob
for f in "$session_dir"/*.kitty-session "$session_dir"/*.kitty_session "$session_dir"/*.session; do
    name=${f##*/}    # basename
    name=${name%.*}  # strip extension
    commands["󰆍  Kitty: ${name//-/ }"]="kitty --session $(printf '%q' "$f")"
done
shopt -u nullglob

# --- Hyprland layouts ------------------------------------------------------
# Nothing here yet. Layout scripts will land in ~/.local/bin and get added as:
#   commands["󰍹  Layout: Odel dev"]="$HOME/.local/bin/layout-odel"
# Entries sort by their icon prefix, so layouts will group apart from sessions.

if [ -z "$1" ]; then
    # rofi script-mode options: a line starting with \0 sets an option,
    # \x1f separates key from value.
    printf '\0prompt\x1fSessions\n'
    printf '\0no-custom\x1ftrue\n'
    printf '\0message\x1fKitty sessions and Hyprland layouts\n'
    printf '%s\n' "${!commands[@]}" | sort
else
    coproc (eval "${commands[$1]}" &>/dev/null)
fi
