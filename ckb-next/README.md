# ckb-next

Reference copy of the ckb-next config for the **Corsair Scimitar RGB Elite**
(wired, USB `1b1c:1be3`). **Not stowed.** ckb-next rewrites the file whenever the
GUI quits, so the live copy in `~/.config/ckb-next/` stays a plain file, and this
one is a snapshot. Re-copy it after changing anything in the GUI.

## Layout

```
 behind wheel   [DPI up   → Home]
                [DPI down → End ]

 thumb  front  [ 1 F17 ] [ 2 F18 ] [ 3 F19  ]
               [ 4 F20 ] [ 5 F21 ] [ 6 F22  ]
               [ 7 Ins ] [ 8 ScrLk][ 9 Fwd  ]   ← mouse5
        back   [10 PgDn] [11 PgUp] [12 Back ]   ← mouse4
```

- Same binds on all 4 modes, so a mode switch can't change them.
- 800 DPI on every stage of every mode. DPI stages and the current stage are
  per-mode in ckb-next, so a mode switch would otherwise change DPI.
- Every key is unique, for game binds (AoE2). F13-F16 and F23/F24 belong to
  the Keychron, so only F17-F22 are free.

## Depends on

- **`ckb-next-git`** (AUR). Stable 0.6.2 predates this revision of the mouse
  (upstream issue #1094).
- `ckb-next-daemon.service` enabled, and the GUI running (`exec-once = ckb-next
  --background` in `hypr`). The GUI is what pushes the binds to the daemon.
- The `xkb` package (`kb_options = fkeys:real`). Without it F17/F18 come out
  as XF86Launch8/9 and **F20 is XF86AudioMicMute**.
- The fast-scroll binds in `hypr` (hold Scroll Lock → `scroll_factor` 5).

## Restoring

Stop the GUI first, or it overwrites the file when it quits. The real process
is `ckb-next.real` (AUR wrapper), so `pkill -x ckb-next` misses it:

```bash
pkill -x ckb-next.real
cp ~/.dotfiles/ckb-next/.config/ckb-next/ckb-next.conf ~/.config/ckb-next/
hyprctl dispatch exec ckb-next
```

The device section is keyed by the mouse's serial, so it only applies to this
exact unit. On a different mouse, rebind from the layout above.
