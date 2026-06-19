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

-- Manual format — intentionally ignores the toggle, so it always works.
vim.keymap.set({ 'n', 'v' }, '<leader>f', function()
	require('conform').format({ async = true, lsp_format = 'fallback' })
end, { desc = '[F]ormat buffer' })

-- Toggle autoformat-on-save (shows under the <leader>t Toggles group).
vim.keymap.set('n', '<leader>tf', function()
	vim.g.disable_autoformat = not vim.g.disable_autoformat
	vim.notify('Autoformat ' .. (vim.g.disable_autoformat and 'OFF' or 'ON'))
end, { desc = '[T]oggle Auto[f]ormat' })
