# Workspace names come from cld's own file, so completion tracks --add/--rm.
function __cld_workspaces
    test -f ~/.config/cld/workspaces; or return
    for line in (cat ~/.config/cld/workspaces)
        set -l parts (string split -m1 \t -- $line)
        printf '%s%s\t%s\n' "$argv[1]" $parts[1] (string replace -- $HOME '~' $parts[2])
    end
end

function __cld_argc
    test (count (commandline -xpc)) -eq $argv[1]
end

complete -c cld -f
complete -c cld -n '__cld_argc 1' -a '(__cld_workspaces --)'
complete -c cld -n '__cld_argc 1' -a --add -d 'Add or update a workspace'
complete -c cld -n '__cld_argc 1' -a --rm -d 'Remove a workspace'
complete -c cld -n '__cld_argc 1' -a --help -d 'List workspaces'
complete -c cld -n '__cld_argc 2; and __fish_seen_argument -l rm' -a '(__cld_workspaces)'
complete -c cld -n '__cld_argc 3; and __fish_seen_argument -l add' -a '(__fish_complete_directories)'
