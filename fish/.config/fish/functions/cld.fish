function cld --description 'cd to a workspace and launch Claude Code'
    switch $argv[1]
        case --system
            cd ~/.dotfiles; and claude $argv[2..]
        case --Odel
            cd ~/dev/Odel; and claude $argv[2..]
        case '' -h --help
            echo "Usage: cld --<workspace> [claude args...]"
            echo ""
            echo "Workspaces:"
            echo "  --system    ~/.dotfiles (dotfiles, AGS, linux config)"
            echo "  --Odel      ~/dev/Odel (Odel platform monorepo + related)"
        case '*'
            echo "cld: unknown workspace: $argv[1]" >&2
            return 1
    end
end
