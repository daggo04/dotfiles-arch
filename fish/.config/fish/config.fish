source /usr/share/cachyos-fish-config/cachyos-config.fish

# overwrite greeting
# potentially disabling fastfetch
#function fish_greeting
#    # smth smth
#end
export PATH="$HOME/.local/bin:$PATH"
set -x EDITOR nvim
set -x VISUAL nvim
set -x LC_TIME en_GB.UTF-8
set -x SUDO_ASKPASS /usr/bin/ksshaskpass
fnm env --use-on-cd --shell fish | source
