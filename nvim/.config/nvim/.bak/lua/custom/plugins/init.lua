-- You can add your own plugins here or in other files in this directory!
--  I promise not to create any merge conflicts in this directory :)
--
-- See the kickstart.nvim README for more information

---@module 'lazy'
---@type LazySpec
return {
  {
    'mikavilpas/yazi.nvim',
    event = 'VeryLazy',
    dependencies = { 'nvim-lua/plenary.nvim' },
    keys = {
      { '<leader>e', '<cmd>Yazi<cr>', desc = 'Open yazi at current file' },
      { '<leader>E', '<cmd>Yazi cwd<cr>', desc = 'Open yazi in working directory' },
    },
    ---@type YaziConfig
    opts = {
      open_for_directories = true,
    },
  },

  { 'folke/snacks.nvim', lazy = false },

  {
    'coder/claudecode.nvim',
    dependencies = { 'folke/snacks.nvim' },
    opts = {
      terminal = {
        split_side = 'right',
        split_width_percentage = 0.30,
        provider = 'snacks',
      },
    },
    keys = {
      { '<leader>a', nil, desc = 'AI/Claude Code' },
      { '<leader>ac', '<cmd>ClaudeCode<cr>', desc = 'Toggle Claude' },
      { '<leader>af', '<cmd>ClaudeCodeFocus<cr>', desc = 'Focus Claude' },
      { '<leader>ar', '<cmd>ClaudeCode --resume<cr>', desc = 'Resume Claude' },
      { '<leader>ab', '<cmd>ClaudeCodeAdd %<cr>', desc = 'Add current buffer' },
      { '<leader>as', '<cmd>ClaudeCodeSend<cr>', mode = 'v', desc = 'Send to Claude' },
      {
        '<leader>aa',
        function()
          vim.cmd('ClaudeCodeDiffAccept')
          vim.defer_fn(function()
            vim.cmd('ClaudeCodeFocus')
          end, 20)
        end,
        desc = 'Accept diff',
      },
      {
        '<leader>ad',
        function()
          vim.cmd('ClaudeCodeDiffDeny')
          vim.defer_fn(function()
            vim.cmd('ClaudeCodeFocus')
          end, 20)
        end,
        desc = 'Deny diff',
      },
    },
  },
}
