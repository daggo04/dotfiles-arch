-- Environment variables and permissions.

-- https://wiki.hypr.land/configuring/core/environment-variables/
-- To reference an existing variable, use os.getenv("NAME").
hl.env('XCURSOR_SIZE', '24')
hl.env('HYPRCURSOR_SIZE', '24')
hl.env('QT_QPA_PLATFORMTHEME', 'qt6ct')
hl.env('QT_STYLE_OVERRIDE', 'kvantum')

-- https://wiki.hypr.land/configuring/core/advanced-configuration/permissions/
-- Only enforced when ecosystem.enforce_permissions is on (it isn't).
-- Permission changes need a Hyprland restart; a reload doesn't apply them.
hl.permission({ binary = '/usr/(bin|local/bin)/grim', type = 'screencopy', mode = 'allow' })
hl.permission({ binary = '/usr/(lib|libexec|lib64)/xdg-desktop-portal-hyprland', type = 'screencopy', mode = 'allow' })
-- hl.permission({ binary = "/usr/(bin|local/bin)/hyprpm", type = "plugin", mode = "allow" })
