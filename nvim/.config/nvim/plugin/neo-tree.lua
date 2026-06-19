local gh = require('util').GH

vim.pack.add {
	gh 'nvim-neo-tree/neo-tree.nvim',
	gh 'nvim-lua/plenary.nvim',
	gh 'MunifTanjim/nui.nvim',
}

require('neo-tree').setup({
	filesystem = {
		follow_current_file = { enabled = true },
		hijack_netrw_behavior = 'open_default',
		use_libuv_file_watcher = true,
		group_empty_dirs = true,
		filtered_items = {
			visible = true,
			hide_dotfiles = false,
			hide_gitignored = false,
		},
    },
	default_component_configs = {
		indent = {
			padding = 0,
			indent_size = 2,
		},
	},
  })

vim.keymap.set('n', '<leader>e', '<cmd>Neotree reveal<CR>', { desc = 'Explorer — reveal current file' })
vim.keymap.set('n', '<leader>E', '<cmd>Neotree toggle<CR>', { desc = 'Explorer — toggle (cwd)' })
