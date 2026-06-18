return {
  {
    'echasnovski/mini.starter',
    version = false,
    event = 'VimEnter',
    config = function()
      local starter = require 'mini.starter'

      local function lazy_stats()
        local ok, lazy = pcall(require, 'lazy')
        if not ok then
          return ''
        end
        local s = lazy.stats()
        local st = s.startuptime or s.startup_time
        local loaded = s.loaded or s.count or 0
        local total = s.count or loaded
        return st and string.format('%d/%d plugins in %.2f ms', loaded, total, st) or string.format('%d plugins', total)
      end

      local v = vim.version()
      local title = string.format([[
      ___           ___           ___                         ___           ___     
     /\  \         /\__\         /\  \         _____         /\  \         /\__\    
     \:\  \       /:/ _/_       /::\  \       /::\  \       /::\  \       /:/ _/_   
      \:\  \     /:/ /\__\     /:/\:\  \     /:/\:\  \     /:/\:\  \     /:/ /\  \  
  _____\:\  \   /:/ /:/ _/_   /:/  \:\  \   /:/  \:\__\   /:/ /::\  \   /:/ /::\  \ 
 /::::::::\__\ /:/_/:/ /\__\ /:/__/ \:\__\ /:/__/ \:|__| /:/_/:/\:\__\ /:/__\/\:\__\
 \:\--\--\/__/ \:\/:/ /:/  / \:\  \ /:/  / \:\  \ /:/  / \:\/:/  \/__/ \:\  \ /:/  /
  \:\  \        \::/_/:/  /   \:\  /:/  /   \:\  /:/  /   \::/__/       \:\  /:/  / 
   \:\  \        \:\/:/  /     \:\/:/  /     \:\/:/  /     \:\  \        \:\/:/  /  
    \:\__\        \::/  /       \::/  /       \::/  /       \:\__\        \::/  /   
     \/__/         \/__/         \/__/         \/__/         \/__/         \/__/    

Neovim %d.%d.%d
      ]], v.major, v.minor, v.patch)

      starter.setup {
        header = function()
          return title
        end,
        items = {
          starter.sections.recent_files(10, false),
          { name = 'New file', action = 'enew', section = 'Actions' },
          { name = 'Find file', action = 'Telescope find_files', section = 'Actions' },
          { name = 'Live grep', action = 'Telescope live_grep', section = 'Actions' },
          { name = 'Config', action = 'edit $MYVIMRC', section = 'Actions' },
          { name = 'Quit', action = 'qa', section = 'Actions' },
        },
        footer = function()
          local cwd = vim.loop.cwd() or ''
          cwd = (#cwd > 0) and ('  ' .. vim.fn.fnamemodify(cwd, ':t')) or ''
          return table.concat({ '', lazy_stats(), cwd }, '\n')
        end,
        evaluate_single = true,
      }

      if vim.fn.argc(-1) == 0 and not vim.g.starter_opened then
        vim.g.starter_opened = true
        vim.api.nvim_create_autocmd('User', {
          pattern = 'LazyVimStarted',
          callback = function()
            pcall(vim.cmd, 'bd')
            starter.open()
          end,
        })
      end

      vim.opt.shortmess:append { I = true }

      vim.keymap.set('n', '<leader>ld', function()
        starter.open()
      end, { desc = '[l]aunch [d]ashboard' })
    end,
  },
}
