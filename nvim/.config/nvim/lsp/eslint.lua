local eslint_markers = {
	'eslint.config.js',
	'eslint.config.mjs',
	'eslint.config.cjs',
	'eslint.config.ts',
	'.eslintrc',
	'.eslintrc.js',
	'.eslintrc.cjs',
	'.eslintrc.json',
	'.eslintrc.yaml',
	'.eslintrc.yml',
}

return {
	cmd = { 'vscode-eslint-language-server', '--stdio' },
	filetypes = {
		'javascript',
		'javascriptreact',
		'typescript',
		'typescriptreact',
	},
	-- Attach ONLY where eslint is actually configured. A plain root_markers
	-- list does NOT gate attachment — native nvim falls back to cwd when none
	-- match, so eslint would wrongly attach in the biome island (odel-docs).
	-- A root_dir function gates it: if no eslint config is found walking up,
	-- we never call on_dir, so no eslint client is created for that buffer.
	root_dir = function(bufnr, on_dir)
		local fname = vim.api.nvim_buf_get_name(bufnr)
		if fname == '' then
			return
		end
		local found = vim.fs.find(eslint_markers, { upward = true, path = vim.fs.dirname(fname) })[1]
		if found then
			on_dir(vim.fs.dirname(found))
		end
	end,
	-- The eslint server wants its workspace folder spelled out explicitly,
	-- otherwise it can fail to resolve the flat config. Mirror lspconfig.
	-- Guard against vim.NIL (userdata, truthy in Lua) when there are none.
	before_init = function(params, config)
		local wf = type(params.workspaceFolders) == 'table' and params.workspaceFolders[1] or nil
		local uri = (wf and wf.uri) or (type(params.rootUri) == 'string' and params.rootUri) or nil
		if uri then
			config.settings.workspaceFolder = {
				uri = uri,
				name = vim.fn.fnamemodify(vim.uri_to_fname(uri), ':t'),
			}
		end
	end,
	settings = {
		validate = 'on',
		-- Must be a string (not nil): the server does path ops on it, and an
		-- undefined nodePath is what crashes its pull-diagnostic handler.
		nodePath = '',
		-- prettier/biome own formatting; eslint only lints in this config.
		format = false,
		quiet = false,
		onIgnoredFiles = 'off',
		rulesCustomizations = {},
		run = 'onType',
		problems = { shortenToSingleLine = false },
		-- Odel hoists nothing: each app has its own node_modules + config.
		-- 'location' uses the file's own dir as cwd; eslint resolves the app's
		-- config + node_modules by walking up from there.
		workingDirectory = { mode = 'location' },
		codeAction = {
			disableRuleComment = { enable = true, location = 'separateLine' },
			showDocumentation = { enable = true },
		},
		codeActionOnSave = { enable = false, mode = 'all' },
	},
}
