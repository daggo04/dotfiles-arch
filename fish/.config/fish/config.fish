source /usr/share/cachyos-fish-config/cachyos-config.fish

# overwrite greeting
# potentially disabling fastfetch
#function fish_greeting
#    # smth smth
#end
export PATH="$HOME/.local/bin:$PATH"
set -x EDITOR nvim
set -x VISUAL nvim
set -x MANPAGER 'nvim +Man!'
set -x LC_TIME en_GB.UTF-8
set -x SUDO_ASKPASS /usr/bin/ksshaskpass
fnm env --use-on-cd --shell fish | source

# pnpm
set -gx PNPM_HOME "/home/dagobh/.local/share/pnpm"
if not string match -q -- $PNPM_HOME $PATH
  set -gx PATH "$PNPM_HOME" $PATH
end
# pnpm end

# app scopes (uwsm): expand to the full systemd commands
if status is-interactive
    abbr -a apps    --set-cursor "systemctl --user list-units 'app-*%*'"
    abbr -a apptree "systemd-cgls --no-pager --user-unit app.slice"
    abbr -a apptop  "systemd-cgtop /user.slice/user-1000.slice/user@1000.service/app.slice"
    abbr -a appstat --set-cursor "systemctl --user status 'app-*%*' -n0 --no-pager"
    abbr -a appkill --set-cursor "systemctl --user stop -T 'app-*%*'"
end
