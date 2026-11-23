-- Window and layer rules — https://wiki.hypr.land/configuring/core/rules/
--
-- Things to know:
-- * `name` must be unique. Calling hl.window_rule() with a name that already
--   exists edits that rule instead of creating a new one.
-- * Static effects (float, size, move, center, workspace…) apply once, when the
--   window opens, so class/title match the window's *initial* values.
-- * class/title are regexes. Find them with `hyprctl clients`.
-- * Scratchpad rules live in scratchpads.lua.

----------------
--  Defaults  --
----------------

hl.window_rule({
	-- Ignore maximize requests from all apps
	name = 'suppress-maximize-events',
	match = { class = '.*' },
	suppress_event = 'maximize',
})

hl.window_rule({
	-- Fix some dragging issues with XWayland
	name = 'fix-xwayland-drags',
	match = {
		class = '^$',
		title = '^$',
		xwayland = true,
		float = true,
		fullscreen = false,
		pin = false,
	},
	no_focus = true,
})

hl.window_rule({
	name = 'move-hyprland-run',
	match = { class = 'hyprland-run' },
	move = '20 monitor_h-120',
	float = true,
})

-----------------------
--  Utility windows  --
-----------------------

-- Float these centred. `size` is optional: leave it out to keep the app's own size.
local floating = {
	{ class = 'pulsemixer', size = { 800, 500 } },
	{ class = 'nmtui', size = { 800, 700 } },
	{ class = 'nm-connection-editor', size = { 600, 400 } },
	{ class = 'nwg-look' },
	{ class = 'updater', size = { 800, 600 } },
	{ class = 'termfilechooser', size = { 1600, 900 } }, -- yazi as the portal file picker
	{ class = 'clip-pick', size = { 1800, 950 } }, -- SUPER+V clipboard picker
}

for _, win in ipairs(floating) do
	hl.window_rule({
		name = 'float-' .. win.class,
		match = { class = win.class },
		float = true,
		center = true,
		size = win.size,
	})
end

-------------
--  Games  --
-------------

-- Dark Souls II (Steam app 335300)
hl.window_rule({
	name = 'ds2-main',
	match = { class = 'steam_app_335300', title = 'DARK SOULS II' },
	float = true,
	size = { 3440, 1440 },
	move = { 0, 0 },
})

hl.window_rule({
	name = 'ds2-flawless',
	match = { class = 'steam_app_335300', title = 'Flawless' },
	float = true,
	center = true,
})

-------------------
--  Layer rules  --
-------------------

-- AGS sidebar and notification popups slide in from the right
hl.layer_rule({
	name = 'sidebar-slide',
	match = { namespace = 'sidebar' },
	animation = 'slide right',
})

hl.layer_rule({
	name = 'notification-popup-slide',
	match = { namespace = 'notification-popup' },
	animation = 'slide right',
})
