function cld --description 'cd to a workspace and launch Claude Code'
    # Workspaces live outside the repo: they're machine-specific paths.
    # One per line: <name><TAB><absolute path>
    set -l file ~/.config/cld/workspaces
    if not test -f $file
        mkdir -p (path dirname $file)
        printf '%s\t%s\n' system ~/.dotfiles Odel ~/dev/Odel >$file
    end

    switch $argv[1]
        case --add
            set -l name $argv[2]
            set -l dir .
            set -q argv[3]; and set dir $argv[3]
            set dir (path resolve -- $dir)
            if not string match -qr '^[A-Za-z0-9_.-]+$' -- "$name"
                echo "Usage: cld --add <name> [path]   (path defaults to .)" >&2
                return 1
            end
            if contains -- $name add rm help h
                echo "cld: '$name' is reserved" >&2
                return 1
            end
            if not test -d $dir
                echo "cld: not a directory: $dir" >&2
                return 1
            end
            set -l rest (string match -v -- "$name	*" <$file)
            string join \n -- $rest "$name	$dir" >$file
            echo "cld --$name -> "(string replace -- $HOME '~' $dir)

        case --rm
            set -l name $argv[2]
            if not string match -q -- "$name	*" <$file
                echo "cld: unknown workspace: $name" >&2
                return 1
            end
            set -l rest (string match -v -- "$name	*" <$file)
            string join \n -- $rest >$file
            echo "cld: removed --$name"

        case '' -h --help
            echo "Usage: cld --<workspace> [claude args...]"
            echo "       cld --add <name> [path]   add or update a workspace (path defaults to .)"
            echo "       cld --rm <name>           remove a workspace"
            echo ""
            echo "Workspaces:"
            for line in (cat $file)
                set -l parts (string split -m1 \t -- $line)
                printf '  --%-12s %s\n' $parts[1] (string replace -- $HOME '~' $parts[2])
            end

        case '--*'
            set -l name (string sub -s 3 -- $argv[1])
            set -l match (string match -- "$name	*" <$file)
            if test -z "$match"
                echo "cld: unknown workspace: $argv[1]" >&2
                return 1
            end
            cd (string split -m1 \t -- $match[1])[2]; and claude $argv[2..]

        case '*'
            echo "cld: unknown workspace: $argv[1]" >&2
            return 1
    end
end
