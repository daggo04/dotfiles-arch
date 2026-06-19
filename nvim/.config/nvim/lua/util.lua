local M = {}

---@param repo string
---@return string
function M.GH(repo) return 'https://github.com/' .. repo end

function M.run_build(name, cmd, cwd)
	local result = vim.system(cmd, { cwd = cwd }):wait()
	if result.code ~= 0 then
    	local stderr = result.stderr or ''
    	local stdout = result.stdout or ''
    	local output = stderr ~= '' and stderr or stdout
    	if output == '' then output = 'No output from build command.' end
    	vim.notify(('Build failed for %s:\n%s'):format(name, output), vim.log.levels.ERROR)
	end
end


return M
