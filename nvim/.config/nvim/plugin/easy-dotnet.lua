local gh = require('util').GH

vim.pack.add({
	{ src = gh('GustavEikaas/easy-dotnet.nvim') },
})

require('easy-dotnet').setup()
