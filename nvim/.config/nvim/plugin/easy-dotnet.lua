local gh = require('util').GH

vim.pack.add({
	{ src = gh('GustavEikaas/easy-dotnet.nvim') },
})

require('easy-dotnet').setup()

-- No formatter wired here on purpose: C# formats through conform's LSP fallback (Roslyn)
-- on save and on <leader>f, matched to VS by a machine-local C:\dev .editorconfig.

local dotnet_group = vim.api.nvim_create_augroup('UserDotnet', { clear = true })
vim.api.nvim_create_autocmd('FileType', {
	group = dotnet_group,
	pattern = { 'cs', 'fsharp' },
	callback = function(ev)
		local map = function(lhs, rhs, desc)
			vim.keymap.set('n', lhs, rhs, { buffer = ev.buf, desc = desc })
		end
		map('<leader>lr', '<cmd>Dotnet run<CR>', 'Run')
		map('<leader>lb', '<cmd>Dotnet build<CR>', 'Build')
		map('<leader>lt', '<cmd>Dotnet test<CR>', 'Test')
		map('<leader>lT', '<cmd>Dotnet testrunner<CR>', 'Test runner')
		map('<leader>ll', '<cmd>Dotnet<CR>', 'Dotnet menu')
	end,
})
