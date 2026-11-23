-- Hardware-specific binds: mouse side buttons, the Scimitar's Scroll Lock, the DualSense touchpad.
--
-- These are Lua functions instead of dispatchers, so their logic runs each time the
-- key is pressed (a condition written directly in hl.bind() is only evaluated once,
-- at config load). Keep these callbacks quick: they run on the compositor's event
-- loop, so anything slow freezes input. Hand shell work to hl.exec_cmd.

local vars = require('modules.vars')
local mainMod = vars.mainMod

-------------------------------------
--  Copy/paste on mouse side keys  --
-------------------------------------

-- mainMod + side buttons. Uses kitty's Ctrl+Shift+C/V when kitty is focused, Ctrl+C/V elsewhere.
-- Deliberately NOT Shift: games bind sneak to Shift and actions to Mouse4/5, so
-- Shift+side-button got swallowed here and knocked the game out of focus.
local function smartCopyPaste(key)
	local win = hl.get_active_window()
	if win and win.class == 'kitty' then
		hl.exec_cmd('wtype -M shift -M ctrl ' .. key .. ' -m ctrl -m shift')
	else
		hl.exec_cmd('wtype -M ctrl ' .. key .. ' -m ctrl')
	end
end

hl.bind(mainMod .. ' + mouse:275', function()
	smartCopyPaste('c')
end, { description = 'Copy (smart)' })
hl.bind(mainMod .. ' + mouse:276', function()
	smartCopyPaste('v')
end, { description = 'Paste (smart)' })

----------------------------------------------
--  Scroll Lock speed tiers (Scimitar key 8) --
----------------------------------------------

-- Stands in for the G502's free-spin wheel:
--   wheel alone           -> 1x (base, vars.scrollFactor)
--   hold Scroll Lock      -> 2x
--   Shift+Scroll Lock     -> 10x: press both, then LET GO OF SHIFT and keep holding
--                            Scroll Lock. Apps treat Shift+wheel as horizontal scroll,
--                            so Shift is only the trigger, not held while scrolling.
-- The release bind ignores mods, so 1x comes back whether Shift is still down or not.
-- non_consuming: games still see Scroll Lock as a bindable key.
local function setScroll(factor)
	return function()
		hl.config({ input = { scroll_factor = factor } })
	end
end

hl.bind('Scroll_Lock', setScroll(2), { non_consuming = true, description = 'Fast scroll on' })
hl.bind('SHIFT + Scroll_Lock', setScroll(10), { non_consuming = true, description = 'Very fast scroll on' })
hl.bind(
	'Scroll_Lock',
	setScroll(vars.scrollFactor),
	{ release = true, non_consuming = true, ignore_mods = true, description = 'Fast scroll off' }
)
-- Belt and braces: `hyprctl binds` doesn't report ignore_mods, so also cover release with Shift held
hl.bind(
	'SHIFT + Scroll_Lock',
	setScroll(vars.scrollFactor),
	{ release = true, non_consuming = true, description = 'Fast scroll off (Shift held)' }
)

-------------------------
--  DualSense touchpad  --
-------------------------

-- Replaces the dualsense-touchpad-toggle script. The touchpad is off by default (input.lua).
-- A config reload re-runs this file, so this flag and the device both go back to "off" together.
local touchpadEnabled = false

hl.bind('SHIFT + F13', function()
	touchpadEnabled = not touchpadEnabled
	hl.device({ name = vars.dualsenseTouchpad, enabled = touchpadEnabled })
	hl.exec_cmd("notify-send -t 1500 'DualSense touchpad' " .. (touchpadEnabled and 'Enabled' or 'Disabled'))
end, { description = 'Toggle DualSense touchpad' })
