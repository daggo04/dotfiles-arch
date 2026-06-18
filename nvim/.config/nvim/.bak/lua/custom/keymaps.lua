-- Remove keybind for <+> moving down one line so that <+y> functions correctly.

vim.keymap.set({ 'n', 'v', 'x' }, '+', '<Nop>')

--terminal mode with Shift+Backspace
vim.keymap.set('t', '<S-BS>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })
