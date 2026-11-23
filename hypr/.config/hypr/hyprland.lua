-- Hyprland config — entry point.
-- Wiki: https://wiki.hypr.land/configuring/  (versioned — pick your release in the selector)
--
-- All settings live in modules/. Each require() runs in its own error scope:
-- a runtime error inside one module is reported and the others still load.
-- A require() of a file that doesn't exist, though, stops this file — so keep
-- this list in sync when adding/removing modules.
--
-- Order matters for binds (they register top to bottom), so the list is explicit
-- rather than a wildcard require.
--
-- Useful while editing:
--   Hyprland --verify-config   check for errors without starting Hyprland
--   hyprctl configerrors       errors in the running config
--   hyprctl repl               poke at the live Lua state (e.g. hl.get_active_window().class)

require('modules.monitors')
require('modules.env')
require('modules.look')
require('modules.animations')
require('modules.input')
require('modules.rules')
require('modules.autostart')
require('modules.scratchpads')
require('modules.binds.wm')
require('modules.binds.apps')
require('modules.binds.media')
require('modules.binds.devices')
