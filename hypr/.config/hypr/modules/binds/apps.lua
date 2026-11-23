-- Launchers, tools and session binds.
-- hl.dsp.exec_cmd runs its string through `sh -c`, so pipes, $(...) and || work.
-- [[ ... ]] is a Lua string that doesn't need its inner quotes escaped.

local vars = require('modules.vars')
local mainMod = vars.mainMod
local exec = hl.dsp.exec_cmd

------------
--  Apps  --
------------

hl.bind(mainMod .. ' + Return', exec(vars.terminal), { description = 'Open terminal' })
hl.bind(mainMod .. ' + E', exec(vars.fileManager), { description = 'Open file manager' })
hl.bind(mainMod .. ' + space', exec(vars.menu), { description = 'App launcher' })
hl.bind(mainMod .. ' + V', exec('~/.local/bin/clip-pick --toggle'), { description = 'Clipboard history' })
hl.bind(mainMod .. ' + N', exec('ags toggle sidebar'), { description = 'Toggle AGS sidebar' })
hl.bind(
	mainMod .. ' + SHIFT + K',
	exec('pkill rofi || rofi -show keybinds'),
	{ description = 'Show keybinds cheatsheet' }
)

-- Herdr spaces: jump to the space, or create it (running claude) if it isn't open
hl.bind(mainMod .. ' + A', exec([[herdr-space "⚙️ System" ~]]), { description = 'Herdr space: System (~)' })
hl.bind(
	mainMod .. ' + G',
	exec([[herdr-space "🎮 Gaming" ~/gaming]]),
	{ description = 'Herdr space: Gaming (~/gaming)' }
)
hl.bind(
	mainMod .. ' + D',
	exec([[herdr-space "🚀 Odel" ~/dev/Odel/Odel]]),
	{ description = 'Herdr space: Odel (~/dev/Odel/Odel)' }
)

---------------
--  Session  --
---------------

hl.bind(mainMod .. ' + SHIFT + M', exec('wlogout'), { description = 'Logout menu' })
hl.bind(mainMod .. ' + SHIFT + L', exec('hyprlock'), { description = 'Lock screen' })

-------------
--  Tools  --
-------------

-- Screenshots (grim + slurp + satty)
hl.bind('Print', exec([[grim -g "$(slurp)" - | satty -f -]]), { description = 'Screenshot region' })
hl.bind('SHIFT + Print', exec('grim - | satty -f -'), { description = 'Screenshot full screen' })

-- Dictation toggle (a second call signals the running instance to stop)
hl.bind('XF86Launch7', exec('dictation'), { description = 'Speech-to-text' })
