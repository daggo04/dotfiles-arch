local gh = require('util').GH
-- ---- Plugins ----
-- This autocommand runs after a plugin is installed or updated and
--  runs the appropriate build command for that plugin if necessary.
--
-- See `:help vim.pack-events`
local run_build = require('util').run_build
vim.api.nvim_create_autocmd('PackChanged', {
	callback = function(ev)
		local name = ev.data.spec.name
		local kind = ev.data.kind
		if kind ~= 'install' and kind ~= 'update' then
			return
		end

		if name == 'telescope-fzf-native.nvim' and vim.fn.executable('make') == 1 then
			run_build(name, { 'make' }, ev.data.path)
			return
		end

		if name == 'LuaSnip' then
			if vim.fn.has('win32') ~= 1 and vim.fn.executable('make') == 1 then
				run_build(name, { 'make', 'install_jsregexp' }, ev.data.path)
			end
			return
		end

		if name == 'nvim-treesitter' then
			if not ev.data.active then
				vim.cmd.packadd('nvim-treesitter')
			end
			vim.cmd('TSUpdate')
			return
		end
	end,
})

vim.pack.add({
	-- Apparence
	{ src = gh('loctvl842/monokai-pro.nvim') },
	{ src = gh('folke/todo-comments.nvim') },

	-- Diagnostics
	{ src = gh('rachartier/tiny-inline-diagnostic.nvim') },
	{ src = gh('folke/lazydev.nvim') },

	-- Git
	{ src = gh('lewis6991/gitsigns.nvim') },

	-- Div
	{ src = gh('nvim-mini/mini.nvim') },
	{ src = gh('folke/which-key.nvim') },
	{ src = gh('nvim-lua/plenary.nvim') },
})

-- ---- Config ----
-- Appearance
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 10
vim.opt.termguicolors = true
vim.opt.signcolumn = 'yes'
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4

-- Make split windows easy to tell apart; re-applied on every theme load
-- mix two #rrggbb colors; t=0 -> a, t=1 -> b
local function blend(a, b, t)
	local function rgb(h)
		return tonumber(h:sub(2, 3), 16), tonumber(h:sub(4, 5), 16), tonumber(h:sub(6, 7), 16)
	end
	local ar, ag, ab = rgb(a)
	local br, bg, bb = rgb(b)
	local function mix(x, y)
		return math.floor(x + (y - x) * t + 0.5)
	end
	return string.format('#%02x%02x%02x', mix(ar, br), mix(ag, bg), mix(ab, bb))
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
MiniIcons.mock_nvim_web_devicons()
require('mini.notify').setup()
vim.notify = require('mini.notify').make_notify()
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

-- Behaviour
vim.opt.autoread = true
vim.opt.updatetime = 200

-- Diagnostics and autocomplete
require('lazydev').setup()
require('tiny-inline-diagnostic').setup({
	preset = 'modern',
	options = {
		multilines = {
			enabled = true,
			always_show = true,
			severity = { vim.diagnostic.severity.ERROR },
		},
	},
})

-- Organization
require('todo-comments').setup()

-- ---- Default Keybinds ----
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>', { desc = 'When in a search, clear the search highlight' })

-- Navigation
vim.keymap.set('n', '<C-d>', '<C-d>zz', { desc = 'Scroll down half the window (centered)' })
vim.keymap.set('n', '<C-u>', '<C-u>zz', { desc = 'Scroll up half the window (centered)' })
vim.keymap.set('n', '<C-h>', '<C-w><C-h>', { desc = 'Move focus to the left window' })
vim.keymap.set('n', '<C-l>', '<C-w><C-l>', { desc = 'Move focus to the right window' })
vim.keymap.set('n', '<C-j>', '<C-w><C-j>', { desc = 'Move focus to the lower window' })
vim.keymap.set('n', '<C-k>', '<C-w><C-k>', { desc = 'Move focus to the upper window' })
local td = require('todo-comments')
vim.keymap.set('n', ']t', function()
	td.jump_next()
end, { desc = 'Next todo comment' })
vim.keymap.set('n', '[t', function()
	td.jump_prev()
end, { desc = 'Prev todo comment' })

-- (w)Yanking
vim.keymap.set({ 'n', 'v' }, '<leader>y', '"+y', { desc = 'Yank to system clipboard' })
vim.keymap.set({ 'n', 'v' }, '<leader>p', '"+p', { desc = 'Paste from system clipboard' })
vim.keymap.set({ 'n', 'v' }, '<leader>d', '"+d', { desc = 'Cut to system clipboard' })

-- Help and diagnostics
vim.keymap.set('n', '<leader>K', function()
	vim.cmd.help(vim.fn.expand('<cword>'))
end, { desc = ' Help for word under cursor' })

-- What was that key again?
require('which-key').setup({
	delay = 0,
})
require('which-key').add({
	-- No explicit icon: which-key's built-in desc rules already icon any group
	-- whose name matches "search"/"toggle", and those glyphs render in this font.
	{ '<leader>s', group = 'Search' },
	{ '<leader>t', group = 'Toggles' },
	-- icon is a function → which-key re-evaluates it per render, so the group
	-- shows whatever filetype you're currently in (mini.icons supplies glyph + color).
	{
		'<leader>l',
		group = 'Language Commands',
		icon = function()
			return { cat = 'filetype', name = vim.bo.filetype }
		end,
	},
})

-- Toggles
vim.keymap.set('n', '<leader>th', function()
	vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled({ bufnr = 0 }), { bufnr = 0 })
end, { desc = 'Toggle Inlay [H]ints' })

-- ---- Autocommands ----
-- - yanking my chains
local yank_group = vim.api.nvim_create_augroup('YankHighlight', { clear = true })
vim.api.nvim_create_autocmd('TextYankPost', {
	group = yank_group,
	callback = function()
		vim.hl.on_yank()
	end,
})

-- Refresh
local autoread_group = vim.api.nvim_create_augroup('AutoRead', { clear = true })
vim.api.nvim_create_autocmd({ 'FocusGained', 'BufEnter', 'CursorHold', 'CursorHoldI' }, {
	group = autoread_group,
	callback = function()
		vim.cmd('checktime')
	end,
})

vim.api.nvim_create_autocmd('FileChangedShellPost', {
	group = autoread_group,
	callback = function()
		vim.notify('Reloaded from disk', vim.log.levels.INFO)
	end,
})

local timer = vim.uv.new_timer()
if timer then
	timer:start(
		1000,
		1000,
		vim.schedule_wrap(function()
			vim.cmd('checktime')
		end)
	)
end

-- ---- LSP ----
vim.lsp.enable({ 'lua_ls', 'vtsls', 'eslint' })
vim.lsp.config('*', {
	capabilities = vim.lsp.protocol.make_client_capabilities(),
})

local lsp_group = vim.api.nvim_create_augroup('UserLsp', { clear = true })
vim.api.nvim_create_autocmd('LspAttach', {
	group = lsp_group,
	callback = function(args)
		local client = vim.lsp.get_client_by_id(args.data.client_id)
		if client then
			-- Announce LSP's as they attach
			vim.notify('LSP attached: ' .. client.name, vim.log.levels.INFO)
			-- Inlays for those that support it
			if client:supports_method('textDocument/inlayHint') then
				vim.lsp.inlay_hint.enable(true, { bufnr = args.buf })
			end
		end
	end,
})
