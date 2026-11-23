-- Started once at login (this replaces exec-once).
-- `hyprland.start` fires once per session, so a config reload doesn't re-run it.
-- Apps that live in a scratchpad (Spotify, Notion) are started from scratchpads.lua.
-- https://wiki.hypr.land/configuring/core/autostart/

hl.on('hyprland.start', function()
	hl.exec_cmd('waybar')
	hl.exec_cmd('cd ~/.config/ags && ags run .')
	hl.exec_cmd('hyprsunset')
	hl.exec_cmd('hypridle')
	hl.exec_cmd('wl-paste --watch ~/.local/bin/cliphist-store') -- stores images + timestamps; see script header
	hl.exec_cmd('hyprpaper')
	-- The ckb-next GUI has to run: it pushes the Corsair Scimitar binds to the daemon at login
	hl.exec_cmd('ckb-next --background')
	hl.exec_cmd('dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP')
end)
