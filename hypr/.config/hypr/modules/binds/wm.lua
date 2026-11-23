-- Window management: windows, layout, resize, focus, workspaces, mouse.
--
-- hl.bind("MODS + key", dispatcher, { flags })
--   https://wiki.hypr.land/configuring/core/binds/          (syntax, key names)
--   https://wiki.hypr.land/configuring/core/binds/flags/    (repeating, locked, mouse, …)
--   https://wiki.hypr.land/configuring/core/dispatchers/    (hl.dsp.*)
-- `description` is what the SUPER+SHIFT+K cheatsheet lists (it reads `hyprctl binds`).

local vars = require('modules.vars')
local mainMod = vars.mainMod

---------------
--  Windows  --
---------------

hl.bind(mainMod .. ' + Q', hl.dsp.window.close(), { description = 'Close active window' })
hl.bind('ALT + F4', hl.dsp.window.close(), { description = 'Close active window' })
hl.bind(mainMod .. ' + F', hl.dsp.window.fullscreen({ mode = 'fullscreen' }), { description = 'Toggle fullscreen' })
hl.bind(
	mainMod .. ' + SHIFT + right',
	hl.dsp.window.float({ action = 'toggle' }),
	{ description = 'Toggle floating window' }
)

-- Dwindle layout
hl.bind(mainMod .. ' + SHIFT + left', hl.dsp.window.pseudo(), { description = 'Toggle pseudo-tile' })
hl.bind(mainMod .. ' + SHIFT + up', hl.dsp.layout('togglesplit'), { description = 'Toggle split direction' })
hl.bind(mainMod .. ' + SHIFT + down', hl.dsp.layout('togglesplit'), { description = 'Toggle split direction' })

-- Resize with mainMod + arrow keys (repeats while held)
local function resizeBy(x, y)
	return hl.dsp.window.resize({ x = x, y = y, relative = true })
end
hl.bind(mainMod .. ' + right', resizeBy(30, 0), { repeating = true, description = 'Resize window wider' })
hl.bind(mainMod .. ' + left', resizeBy(-30, 0), { repeating = true, description = 'Resize window narrower' })
hl.bind(mainMod .. ' + up', resizeBy(0, -30), { repeating = true, description = 'Resize window shorter' })
hl.bind(mainMod .. ' + down', resizeBy(0, 30), { repeating = true, description = 'Resize window taller' })

-------------
--  Focus  --
-------------

-- Vim keys
hl.bind(mainMod .. ' + h', hl.dsp.focus({ direction = 'left' }), { description = 'Focus window left' })
hl.bind(mainMod .. ' + l', hl.dsp.focus({ direction = 'right' }), { description = 'Focus window right' })
hl.bind(mainMod .. ' + k', hl.dsp.focus({ direction = 'up' }), { description = 'Focus window up' })
hl.bind(mainMod .. ' + j', hl.dsp.focus({ direction = 'down' }), { description = 'Focus window down' })

------------------
--  Workspaces  --
------------------

-- mainMod + [1-9,0] switches workspace; add SHIFT to take the active window along.
-- The 0 key is workspace 10.
for i = 1, 10 do
	local key = tostring(i % 10)
	hl.bind(mainMod .. ' + ' .. key, hl.dsp.focus({ workspace = i }), { description = 'Go to workspace ' .. i })
	hl.bind(
		mainMod .. ' + SHIFT + ' .. key,
		hl.dsp.window.move({ workspace = i }),
		{ description = 'Move window to workspace ' .. i }
	)
end

-- Scroll through existing workspaces
hl.bind(mainMod .. ' + mouse_down', hl.dsp.focus({ workspace = 'e+1' }), { description = 'Next workspace' })
hl.bind(mainMod .. ' + mouse_up', hl.dsp.focus({ workspace = 'e-1' }), { description = 'Previous workspace' })

-------------
--  Mouse  --
-------------

-- Move/resize windows with mainMod + LMB/RMB drag
hl.bind(mainMod .. ' + mouse:272', hl.dsp.window.drag(), { mouse = true, description = 'Move window (drag)' })
hl.bind(mainMod .. ' + mouse:273', hl.dsp.window.resize(), { mouse = true, description = 'Resize window (drag)' })
