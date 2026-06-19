-- ---- Plugins ----
vim.pack.add({
	-- Apparence
	{ src = 'https://github.com/loctvl842/monokai-pro.nvim' },
	{ src = 'https://github.com/MunifTanjim/nui.nvim' },

	-- Diagnostics
	{ src = 'https://github.com/rachartier/tiny-inline-diagnostic.nvim'},
	{ src = 'https://github.com/folke/lazydev.nvim' },

	-- File manager
	{ src = 'https://github.com/nvim-neo-tree/neo-tree.nvim' },

	-- Git
	{ src = 'https://github.com/lewis6991/gitsigns.nvim' },

	-- Div
	{ src = 'https://github.com/nvim-mini/mini.nvim' },
	{ src = 'https://github.com/folke/which-key.nvim' },
	{ src = 'https://github.com/nvim-lua/plenary.nvim' }
})


-- ---- Config ---- 
-- Appearance
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 10
vim.opt.termguicolors = true
vim.opt.signcolumn = 'yes'

-- Make split windows easy to tell apart; re-applied on every theme load
-- mix two #rrggbb colors; t=0 -> a, t=1 -> b
local function blend(a, b, t)
	local function rgb(h) return tonumber(h:sub(2,3),16), tonumber(h:sub(4,5),16), tonumber(h:sub(6,7),16) end
	local ar,ag,ab = rgb(a)
	local br,bg,bb = rgb(b)
	local function mix(x,y) return math.floor(x+(y-x)*t + 0.5) end
	return string.format('#%02x%02x%02x', mix(ar,br), mix(ag,bg), mix(ab,bb))
end
local ui_group = vim.api.nvim_create_augroup('UiTweaks', { clear = true })
vim.api.nvim_create_autocmd('ColorScheme', {
	group = ui_group,
	pattern = 'monokai-pro*',
	callback = function()
		local p = require('monokai-pro').get_palette()
		vim.api.nvim_set_hl(0, 'WinSeparator', { fg = p.dimmed3, bold = true })
		vim.api.nvim_set_hl(0, 'NormalNC', { bg = blend(p.background, p.dark1, 0.5) })
	end,
})

vim.cmd.colorscheme('monokai-pro-octagon')
require('mini.icons').setup()
require('mini.icons').mock_nvim_web_devicons()
require('gitsigns').setup({
	on_attach = function(bufnr)
		local gs = require('gitsigns')
		vim.keymap.set('n', ']c', function()
			gs.nav_hunk('next')
		end, { buffer = bufnr, desc = 'Jump to next hunk of git changes' })
		vim.keymap.set('n', '[c', function()
			gs.nav_hunk('prev')
		end, { buffer = bufnr, desc = 'Jump to prev hunk of git changes' })
	end,
})

-- Search and macros
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- Controls 
vim.opt.mouse = 'a'

-- Diagnostics and automcomplete
require('lazydev').setup()
require('tiny-inline-diagnostic').setup({
	preset = 'modern',
	options = {
		multilines = {
			enabled = true,
			always_show = true,
			severity = {vim.diagnostic.severity.ERROR},
		}
	}
})

-- File Explorer
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

-- ---- Default Keybinds ---- 
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>', { desc = 'When in a search, clear the search highlight'})

-- Navigation
vim.keymap.set('n', '<C-d>', '<C-d>zz', { desc = 'Scroll down half the window (centered)'})
vim.keymap.set('n', '<C-u>', '<C-u>zz', { desc = 'Scroll up half the window (centered)'})

-- (w)Yanking
vim.keymap.set({'n', 'v'}, '<leader>y', '"+y', { desc = 'Yank to system clipboard'})
vim.keymap.set({'n', 'v'}, '<leader>p', '"+p', { desc = 'Paste from system clipboard'})
vim.keymap.set({'n', 'v'}, '<leader>d', '"+d', { desc = 'Cut to system clipboard'})

-- Help and diagnostics
vim.keymap.set('n', '<leader>K', function()
	vim.cmd.help(vim.fn.expand('<cword>'))
end, { desc = ' Help for word under cursor' })



-- What was that key again? 
require('which-key').setup()


-- ---- Autocommands ---- 
-- - yanking my chains
local yank_group = vim.api.nvim_create_augroup('YankHighlight', { clear = true })

vim.api.nvim_create_autocmd('TextYankPost', {
	group = yank_group,
	callback = function()
		vim.hl.on_yank()
	end,
})


-- ---- LSP ----
vim.lsp.config('lua_ls', {
	cmd = { 'lua-language-server' } ,
	filetypes = { 'lua' },
	root_markers = { '.luarc.json', '.luarc.jsonc', 'luarc.yaml', '.git' },
	settings = {
		Lua = {
		runtime = { version = 'LuaJIT' },
		diagnostics = { globals = { 'vim' } },
		workspace = {
			checkThirdParty = false,
			},
		},
	},
})
vim.lsp.enable('lua_ls')


