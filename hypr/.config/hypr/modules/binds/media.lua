-- Volume, mic, brightness, media players, and the Keychron Q6 Max knob.
-- `locked = true` keeps a bind working on the lock screen; `repeating = true` repeats while held.

local vars = require('modules.vars')
local mainMod = vars.mainMod
local exec = hl.dsp.exec_cmd

----------------------
--  Volume and mic  --
----------------------

hl.bind(
	'XF86AudioRaiseVolume',
	exec('wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+'),
	{ locked = true, repeating = true, description = 'Volume up' }
)
hl.bind(
	'XF86AudioLowerVolume',
	exec('wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-'),
	{ locked = true, repeating = true, description = 'Volume down' }
)
hl.bind(
	'XF86AudioMute',
	exec('wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle'),
	{ locked = true, repeating = true, description = 'Mute output' }
)
hl.bind(
	'XF86AudioMicMute',
	exec('wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle'),
	{ locked = true, repeating = true, description = 'Mute microphone' }
)

-- Keychron Q6 Max mic key sends Super+C. Toggles the mic and shows its new
-- state; the synchronous hint replaces the previous popup instead of stacking.
local micToggleNotify = [[
wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle || exit 1
if wpctl get-volume @DEFAULT_AUDIO_SOURCE@ | grep -q MUTED; then
	notify-send -e -a Microphone -h string:x-canonical-private-synchronous:micmute -i microphone-sensitivity-muted "Mic muted"
else
	notify-send -e -a Microphone -h string:x-canonical-private-synchronous:micmute -i audio-input-microphone "Mic live"
fi
]]
hl.bind(mainMod .. ' + C', exec(micToggleNotify), { locked = true, description = 'Mute microphone' })

------------------
--  Brightness  --
------------------

hl.bind(
	'XF86MonBrightnessUp',
	exec('brightnessctl -e4 -n2 set 5%+'),
	{ locked = true, repeating = true, description = 'Brightness up' }
)
hl.bind(
	'XF86MonBrightnessDown',
	exec('brightnessctl -e4 -n2 set 5%-'),
	{ locked = true, repeating = true, description = 'Brightness down' }
)

--------------------------------
--  Media player (playerctl)  --
--------------------------------

hl.bind('XF86AudioNext', exec('playerctl next'), { locked = true, description = 'Next track' })
hl.bind('XF86AudioPause', exec('playerctl play-pause'), { locked = true, description = 'Play/pause' })
hl.bind('XF86AudioPlay', exec('playerctl play-pause'), { locked = true, description = 'Play/pause' })
hl.bind('XF86AudioPrev', exec('playerctl previous'), { locked = true, description = 'Previous track' })

----------------------------
--  Keychron Q6 Max knob  --
----------------------------

-- Turning sends F23/F24 (remapped in VIA); pressing sends XF86AudioMute.
hl.bind('F23', exec('app-volume -5'), { description = 'Focused app volume down' })
hl.bind('F24', exec('app-volume +5'), { description = 'Focused app volume up' })

-- SUPER + knob zooms the screen around the cursor (this replaces the zoom-step script).
-- Steps of 1.25x, snapping back to 1 (no zoom) near the bottom, capped at 10.
local function zoom(direction)
	local factor = hl.get_config('cursor.zoom_factor')
	if direction == 'in' then
		factor = factor * 1.25
	elseif direction == 'out' then
		factor = factor / 1.25
	else
		factor = 1
	end
	if factor < 1.05 then
		factor = 1
	end
	factor = math.min(factor, 10)
	hl.config({ cursor = { zoom_factor = factor } })
end

hl.bind(mainMod .. ' + F23', function()
	zoom('in')
end, { description = 'Zoom in' })
hl.bind(mainMod .. ' + F24', function()
	zoom('out')
end, { description = 'Zoom out' })
hl.bind(mainMod .. ' + XF86AudioMute', function()
	zoom('reset')
end, { description = 'Reset zoom' })
