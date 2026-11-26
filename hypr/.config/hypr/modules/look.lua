-- Appearance, layouts and misc.
-- Every option: https://wiki.hypr.land/configuring/core/config-options/
-- Colours are strings: "rgba(RRGGBBAA)", "rgb(RRGGBB)", "#RRGGBB" or "0xAARRGGBB".

hl.config({
	general = {
		gaps_in = 3,
		gaps_out = 8,

		border_size = 2,

		col = {
			active_border = 'rgba(ff657aee)',
			inactive_border = 'rgba(3a3d4baa)',
		},

		-- Resize windows by dragging their borders/gaps
		resize_on_border = true,

		-- See https://wiki.hypr.land/configuring/extra/tearing/ before turning this on
		allow_tearing = false,

		layout = 'dwindle',
	},

	decoration = {
		rounding = 10,
		rounding_power = 2,

		active_opacity = 0.85,
		inactive_opacity = 0.85,

		shadow = {
			enabled = true,
			range = 12,
			render_power = 3,
			color = 'rgba(161821cc)',
		},

		blur = {
			enabled = true,
			size = 5,
			passes = 3,
			new_optimizations = true,
			vibrancy = 0.2,
		},
	},

	-- https://wiki.hypr.land/configuring/layouts/dwindle-layout/
	dwindle = {
		preserve_split = true,
	},

	-- https://wiki.hypr.land/configuring/layouts/master-layout/
	master = {
		new_status = 'master',
	},

	misc = {
		force_default_wallpaper = 0,
		disable_hyprland_logo = true,
		vrr = 1,
	},
})
