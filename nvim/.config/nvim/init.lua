-- ---- Global Keybinds ---- 
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>', { desc = 'When in a search, clear the search highlight'})
vim.keymap.set('n', '<C-d>', '<C-d>zz', { desc = 'Scroll down half the window (centered)'})
vim.keymap.set('n', '<C-u>', '<C-u>zz', { desc = 'Scroll up half the window (centered)'})
vim.keymap.set('n', '<leader>K', function()
	vim.cmd.help(vim.fn.expand('<cword>'))
end, { desc = ' Help for word under cursor' })


-- ---- Global Opts ---- 
-- Appearance
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 10
vim.opt.termguicolors = true


-- Search and macros
vim.opt.ignorecase = true
vim.opt.smartcase = true


-- - Babysteps - 
--TODO: Change these when not a noob
vim.opt.mouse = 'a'


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
			checkThidParty = false,
			},
		},
	},
})
vim.lsp.enable('lua_ls')
