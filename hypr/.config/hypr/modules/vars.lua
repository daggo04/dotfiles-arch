-- Values shared between modules.
--
-- A `local` only exists inside the file that declares it, so anything more than
-- one module needs lives here. Use it with:
--   local vars = require("modules.vars")

local M = {}

-- "Windows" key as the main modifier
M.mainMod = 'SUPER'

-- Programs
M.terminal = 'uwsm app -- kitty'
M.fileManager = 'uwsm app -- kitty -e yazi'
M.menu = 'pkill rofi || rofi -show drun'

-- Base mouse-wheel speed (1x). input.lua sets it; the Scroll Lock speed tiers in
-- binds/devices.lua restore it on release.
M.scrollFactor = 1

-- DualSense Edge touchpad (find names with `hyprctl devices`). Disabled in
-- input.lua, toggled in binds/devices.lua.
M.dualsenseTouchpad = 'sony-interactive-entertainment-dualsense-edge-wireless-controller-touchpad'

return M
