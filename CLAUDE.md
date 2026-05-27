# dotfiles-arch

Linux desktop/system workspace. Dotfiles are managed with GNU Stow — each top-level directory is a Stow package that gets symlinked into `~/` (or `~/.config/`) from here.

Remote: https://github.com/daggo04/dotfiles-arch

## Scope of work in this repo

- Dotfile changes (hypr, nvim, kitty, waybar, rofi, swaync, wlogout, theme)
- AGS sidebar development (`ags/` — GTK4, notifications, media, audio, brightness, blue light, system stats, power menu)
- Neovim plugin authoring and config tweaks (kickstart-based)
- General Linux/CachyOS setup notes, kernel/driver quirks, install scripts

## System context

### Wifi — TP-Link TBE550E (MediaTek MT7927), mediatek-mt7927-dkms

Current wifi/BT card is a **TP-Link TBE550E** (MediaTek MT7927, PCI `05:00.0`, IDs `14c3:7927`). Mainline kernel doesn't fully support it yet, so the driver comes from the **`mediatek-mt7927-dkms`** AUR package.

**Quirk worth knowing:** the chip is MT7927 but the loaded kernel module is `mt7925e` (the MT7927 is supported via patches to the mt7925 driver family). Don't be confused when `lsmod` shows `mt7925e` rather than something named `mt7927`.

**Fragility:** kernel updates auto-trigger DKMS rebuilds. If the patchset lags a new kernel's API, the rebuild fails silently during `paru -Syu` (only a scroll-by warning) and you boot with no wifi.

**Kernel upgrade checklist:**
- Have ethernet fallback, or boot the `linux-cachyos-lts` backup kernel from limine (mt7927 module is also built for LTS per `dkms status`).
- After `paru -Syu` with a kernel bump, verify `dkms status` shows `mediatek-mt7927` built for the new kernel *before* rebooting.
- If rebuild fails: rebuild the AUR package (`paru -S mediatek-mt7927-dkms`), or boot LTS from limine and investigate.
- Once the patches land in mainline (track upstream), this DKMS dependency goes away.

**Historical note:** previous card was a Realtek RTL8812AE on an `rtw88` DKMS backport — fully removed 2026-05-27. If you see `rtw88` references in git history, that's the old setup.

NVIDIA modules are handled by `linux-cachyos-nvidia-open` (extramodules) — no manual DKMS concerns there.
