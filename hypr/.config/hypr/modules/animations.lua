-- Animations — https://wiki.hypr.land/configuring/core/animations/
-- Leaves not listed here (e.g. border, workspacesIn) use Hyprland's defaults.

hl.config({ animations = { enabled = true } })

-- Curves: two control points of a cubic bezier
hl.curve('myBezier', { type = 'bezier', points = { { 0.05, 0.9 }, { 0.1, 1.05 } } }) -- smooth, slight overshoot
hl.curve('smoothSlide', { type = 'bezier', points = { { 0.25, 1 }, { 0.5, 1 } } })
hl.curve('bounceSlide', { type = 'bezier', points = { { 0.2, 1.1 }, { 0.4, 1.0 } } })

-- Windows pop in/out
hl.animation({ leaf = 'windows', enabled = true, speed = 5, bezier = 'myBezier', style = 'popin 80%' })
hl.animation({ leaf = 'windowsOut', enabled = true, speed = 5, bezier = 'myBezier', style = 'popin 80%' })

-- Layers (rofi, waybar) fade; the sidebar's slide is a layer rule in rules.lua
hl.animation({ leaf = 'layers', enabled = true, speed = 5, bezier = 'myBezier', style = 'fade' })
hl.animation({ leaf = 'layersIn', enabled = true, speed = 5, bezier = 'bounceSlide', style = 'fade' })
hl.animation({ leaf = 'layersOut', enabled = true, speed = 5, bezier = 'myBezier', style = 'fade' })

hl.animation({ leaf = 'fade', enabled = true, speed = 5, bezier = 'myBezier' })

-- Workspaces slide horizontally
hl.animation({ leaf = 'workspaces', enabled = true, speed = 3, bezier = 'smoothSlide', style = 'slide' })

-- Special workspaces (scratchpads) fade
hl.animation({ leaf = 'specialWorkspaceIn', enabled = true, speed = 5, bezier = 'myBezier', style = 'fade' })
hl.animation({ leaf = 'specialWorkspaceOut', enabled = true, speed = 5, bezier = 'myBezier', style = 'fade' })
