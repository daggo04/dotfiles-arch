-- Scratchpads: named special workspaces you toggle with SUPER + key.
--
-- Each app entry below sets up three things:
--   1. the SUPER + key toggle bind
--   2. a window rule that sends the app's window to its special workspace, floating and sized
--   3. optionally, launching the app at login (it starts hidden in its scratchpad)
-- To add a scratchpad, add an entry to `apps`.

local vars = require('modules.vars')
local mainMod = vars.mainMod

-- Generic scratchpad: SUPER+SHIFT+S sends any window there
hl.bind(mainMod .. ' + S', hl.dsp.workspace.toggle_special('magic'), { description = 'Toggle scratchpad' })
hl.bind(
	mainMod .. ' + SHIFT + S',
	hl.dsp.window.move({ workspace = 'special:magic' }),
	{ description = 'Move window to scratchpad' }
)

local apps = {
	{
		name = 'spotify',
		key = 'M',
		label = 'Spotify',
		class = '^(Spotify)$',
		size = { 2060, 860 },
		autostart = 'spotify-launcher',
	},
	{
		name = 'notion',
		key = 'O',
		label = 'Notion',
		class = '^(notion)$',
		size = { 3200, 1300 },
		autostart = '/usr/bin/notion-app',
	},
	{
		-- Steam app 1267910, launched on demand (no autostart)
		name = 'melvor',
		key = 'I',
		label = 'Melvor Idle',
		class = '^(Melvor Idle)$',
		size = { 2184, 1388 },
		move = { 11, 43 }, -- fixed position instead of centred
	},
}

for _, app in ipairs(apps) do
	hl.bind(
		mainMod .. ' + ' .. app.key,
		hl.dsp.workspace.toggle_special(app.name), -- no "special:" prefix here
		{ description = 'Toggle ' .. app.label .. ' scratchpad' }
	)

	local rule = {
		name = app.name .. '-scratchpad',
		match = { class = app.class },
		workspace = 'special:' .. app.name .. ' silent',
		float = true,
		size = app.size,
	}
	if app.move then
		rule.move = app.move
	else
		rule.center = true
	end
	hl.window_rule(rule)
end

hl.on('hyprland.start', function()
	for _, app in ipairs(apps) do
		if app.autostart then
			hl.exec_cmd(app.autostart)
		end
	end
end)
