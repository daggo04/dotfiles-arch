#!/bin/bash

# Rofi custom command palette

declare -A commands
commands=(
    ["󰕾  Audio Mixer"]="kitty --class pulsemixer -e pulsemixer"
    ["󰖩  WiFi Settings"]="kitty --class nmtui -e nmtui"
    ["󰃠  Brightness Up"]="/usr/bin/ddcutil setvcp 10 + 10"
    ["󰃞  Brightness Down"]="/usr/bin/ddcutil setvcp 10 - 10"
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

if [ -z "$1" ]; then
    printf '%s\n' "${!commands[@]}" | sort
else
    coproc (eval "${commands[$1]}" &>/dev/null)
fi
