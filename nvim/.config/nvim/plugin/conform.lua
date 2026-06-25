-- conform.nvim — formatting. Self-contained: install + config + keymaps.
-- vim.pack.add runs synchronously, and plugin/ files load after init.lua,
-- so the require('conform') below resolves on first launch.
local gh = require('util').GH
vim.pack.add({
	{ src = gh('stevearc/conform.nvim') },
})

require('conform').setup({
	formatters_by_ft = {
		lua = { 'stylua' },
		-- biome wins only inside its island (see condition); else prettier.
		javascript = { 'biome', 'prettier', stop_after_first = true },
		javascriptreact = { 'biome', 'prettier', stop_after_first = true },
		typescript = { 'biome', 'prettier', stop_after_first = true },
		typescriptreact = { 'biome', 'prettier', stop_after_first = true },
		json = { 'biome', 'prettier', stop_after_first = true },
		jsonc = { 'biome', 'prettier', stop_after_first = true },
		css = { 'biome', 'prettier', stop_after_first = true },
		-- biome 2 doesn't format these; prettier is the universal choice.
		markdown = { 'prettier' },
		yaml = { 'prettier' },
		html = { 'prettier' },
	},
	formatters = {
		-- Only let biome run when a biome.json is found walking up from the
		-- file. Guards against scrambling prettier-managed files (and vice
		-- versa) in the Odel monorepo, where odel-docs is the lone biome app.
		biome = {
			condition = function(_, ctx)
				return vim.fs.root(ctx.filename, { 'biome.json', 'biome.jsonc' }) ~= nil
			end,
		},
	},
	-- Return nil to skip. The two flags below are what <leader>tf flips.
	format_on_save = function(bufnr)
		if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
			return
		end
		return { timeout_ms = 1000, lsp_format = 'fallback' }
	end,
})

-- Can this buffer actually format? Mirrors the lsp_format = 'fallback' logic
-- format() uses: a conform formatter that passes its condition, or an LSP that
-- can format. Used to keep <leader>f out of buffers where it would do nothing.
local function formattable(bufnr)
	if not vim.tbl_isempty(require('conform').list_formatters(bufnr)) then
		return true
	end
	for _, client in ipairs(vim.lsp.get_clients({ bufnr = bufnr })) do
		if client:supports_method('textDocument/formatting') then
			return true
		end
	end
	return false
end

-- Manual format keymap, buffer-local so which-key only lists it where it works.
-- Availability is known at FileType (conform) and LspAttach (LSP), so check both;
-- the buffer flag makes the one-time setup idempotent.
local fmt_keys = vim.api.nvim_create_augroup('UserConformKeys', { clear = true })
vim.api.nvim_create_autocmd({ 'FileType', 'LspAttach' }, {
	group = fmt_keys,
	callback = function(ev)
		local buf = ev.buf
		if vim.b[buf].format_key_set or not formattable(buf) then
			return
		end
		vim.b[buf].format_key_set = true

		-- Ignores the autoformat toggle on purpose, so manual format always works.
		vim.keymap.set({ 'n', 'v' }, '<leader>f', function()
			require('conform').format({ async = true, lsp_format = 'fallback' })
		end, { buffer = buf, desc = '[F]ormat buffer' })

		require('which-key').add({
			{
				'<leader>f',
				buffer = buf,
				mode = { 'n', 'v' },
				icon = function()
					return { cat = 'filetype', name = vim.bo.filetype }
				end,
			},
		})
	end,
})

-- Toggle autoformat-on-save (shows under the <leader>t Toggles group).
vim.keymap.set('n', '<leader>tf', function()
	vim.g.disable_autoformat = not vim.g.disable_autoformat
	vim.notify('Autoformat ' .. (vim.g.disable_autoformat and 'OFF' or 'ON'))
end, { desc = 'Toggle Auto[f]ormat on save' })
