#!/usr/bin/env bash
# keybinds.sh — Hyprland keybind cheatsheet as a rofi script mode (a tab).
#
# Wired into hyprland.conf as a rofi modi, e.g.:
#   rofi -show drun -modi drun,keybinds:/home/dagobh/.config/hypr/scripts/keybinds.sh
#
# Rofi calls this with no args to populate the tab. On selection it calls it
# again with the chosen row as $1 — there's nothing to launch (read-only
# cheatsheet), so we just exit. The list is read LIVE from `hyprctl binds`,
# so it always matches the current config; only binds declared with `bindd`
# (i.e. given a description) show up.

[ -n "$1" ] && exit 0

# rofi script-mode options: a line starting with \0 sets an option,
# \x1f separates key from value.
printf '\0prompt\x1fKeybinds\n'
printf '\0no-custom\x1ftrue\n'
printf '\0message\x1fHyprland keyboard shortcuts — type to filter\n'

hyprctl binds -j | jq -r '
  # Test whether bit $b is set in modmask $m.
  def bit($m; $b): (($m / $b) | floor) % 2 == 1;
  # Hyprland modmask bits: Shift=1, Ctrl=4, Alt=8, Super=64.
  def mods($m): [
    (if bit($m;64) then "Super" else empty end),
    (if bit($m;4)  then "Ctrl"  else empty end),
    (if bit($m;8)  then "Alt"   else empty end),
    (if bit($m;1)  then "Shift" else empty end)
  ] | join(" + ");
  [ .[] | select(.description != "") ]
  | sort_by(.description)[]
  | ((if .modmask == 0 then "" else mods(.modmask) + " + " end) + .key)
    + "\t" + .description
' | column -t -s $'\t'
