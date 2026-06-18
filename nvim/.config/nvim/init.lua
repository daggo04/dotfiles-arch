-- ---- Plugins ----
vim.pack.add({
	-- Theme
	{ src = 'https://github.com/loctvl842/monokai-pro.nvim' },

	-- Diagnostics
	{ src = 'https://github.com/rachartier/tiny-inline-diagnostic.nvim'},
	{ src = 'https://github.com/folke/lazydev.nvim' },

	-- File manager

	-- Div
	{ src = 'https://github.com/nvim-mini/mini.nvim' },
	{ src = 'https://github.com/folke/which-key.nvim'}
})


-- ---- Config ---- 
-- Appearance
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 10
vim.opt.termguicolors = true

-- Make split windows easy to tell apart; re-applied on every theme load
local ui_group = vim.api.nvim_create_augroup('UiTweaks', { clear = true })
vim.api.nvim_create_autocmd('ColorScheme', {
	group = ui_group,
	pattern = 'monokai-pro*',
	callback = function()
		local p = require('monokai-pro').get_palette()
		vim.api.nvim_set_hl(0, 'WinSeparator', { fg = p.dimmed3, bold = true })
		vim.api.nvim_set_hl(0, 'NormalNC', { bg = p.dark1 })
	end,
})

vim.cmd.colorscheme('monokai-pro-octagon')
require('mini.icons').setup()


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
			library = vim.api.nvim_get_runtime_file('', true),
			checkThirdParty = false,
			},
		},
	},
})
vim.lsp.enable('lua_ls')


