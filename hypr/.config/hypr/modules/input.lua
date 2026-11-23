-- Keyboard, mouse, touchpad, gestures and per-device settings.

local vars = require('modules.vars')

hl.config({
	input = {
		kb_layout = 'no',
		kb_variant = 'nodeadkeys',
		kb_model = 'pc105',
		-- Keep F13–F24 as real F-keys; stock xkb turns F17+ into media keys
		-- (F20 = mic mute), which broke the mouse thumb-button binds.
		kb_options = 'fkeys:real',
		numlock_by_default = true,

		follow_mouse = 1,

		scroll_factor = vars.scrollFactor,

		touchpad = {
			natural_scroll = false,
		},
	},
})

-- https://wiki.hypr.land/configuring/core/binds/gestures/
hl.gesture({ fingers = 3, direction = 'horizontal', action = 'workspace' })

-- Per-device settings — https://wiki.hypr.land/configuring/core/devices/
-- The DualSense touchpad acts as a mouse; off by default, SHIFT+F13 toggles it.
hl.device({
	name = vars.dualsenseTouchpad,
	enabled = false,
})
