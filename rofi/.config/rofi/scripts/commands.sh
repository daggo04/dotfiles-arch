#!/bin/bash

# Rofi custom command palette

declare -A commands
commands=(
    ["󰕾  Audio Mixer"]="kitty --class pulsemixer -e pulsemixer"
    ["󰖩  WiFi Settings"]="kitty --class nmtui -e nmtui"
    ["󰃠  Brightness Up"]="$HOME/.local/bin/brightness-step + 10"
    ["󰃞  Brightness Down"]="$HOME/.local/bin/brightness-step - 10"
    ["󰏘  GTK Theme"]="nwg-look"
    ["󰌾  Lock Screen"]="hyprlock"
    ["󰍃  Logout"]="wlogout"
    ["󰍯  Neovim"]="kitty -e nvim"
    ["󰉋  File Manager"]="kitty -e yazi"
    ["󰍛  System Monitor"]="kitty --class btop -e btop"
    ["󰑓  Reload Waybar"]="pkill waybar; waybar"
    ["󰑓  Reload Swaync"]="pkill swaync; swaync"
    ["󰅖  Kill Window"]="hyprctl dispatch killactive"
)

# --- sun-adapt -------------------------------------------------------------
# Toggle via the daemon's own on/off flag, NOT `systemctl disable`: this unit
# file is a Stow symlink, and systemd deletes such symlinks when disabling it.
if [ "$(sun-adapt state 2>/dev/null)" = "off" ]; then
    commands["󰖘  Sun-adapt: turn ON"]="sun-adapt on && notify-send -i weather-clear 'Sun-adapt' 'Automatic brightness and tint enabled'"
else
    commands["󰖘  Sun-adapt: turn OFF"]="sun-adapt off && notify-send -i weather-clear-night 'Sun-adapt' 'Automatic brightness and tint disabled'"
    commands["󰔛  Sun-adapt: pause 2h"]="sun-adapt pause 120 && notify-send -i weather-clear-night 'Sun-adapt' 'Paused 2h, then resumes on its own'"
fi
commands["󰋽  Sun-adapt: status"]="notify-send -i weather-clear 'Sun-adapt' \"\$(sun-adapt status)\""

if [ -z "$1" ]; then
    printf '%s\n' "${!commands[@]}" | sort
else
    coproc (eval "${commands[$1]}" &>/dev/null)
fi
