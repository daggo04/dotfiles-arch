# dotfiles-arch

Linux desktop/system workspace. Dotfiles are managed with GNU Stow — each top-level directory is a Stow package that gets symlinked into `~/` (or `~/.config/`) from here.

Remote: https://github.com/daggo04/dotfiles-arch

## Scope of work in this repo

- Dotfile changes (hypr, nvim, kitty, waybar, rofi, swaync, wlogout, theme)
- AGS sidebar development (`ags/` — GTK4, notifications, media, audio, brightness, blue light, system stats, power menu)
- Neovim plugin authoring and config tweaks (kickstart-based)
- General Linux/CachyOS setup notes, kernel/driver quirks, install scripts

## System context

### Wifi — RTL8812AE, manual rtw88 DKMS backport

The wifi card (Realtek RTL8812AE, PCI 05:00.0) uses the `rtw_8812ae` module from a **manually-installed rtw88 DKMS backport** at `/var/lib/dkms/rtw88/0.6` (not owned by any pacman/AUR package, likely from lwfinger/rtw88 git).

**Fragility:** kernel updates auto-trigger DKMS rebuilds. If the backport lags a new kernel's API, the rebuild fails silently during `paru -Syu` (only a scroll-by warning) and you boot with no wifi.

**Kernel upgrade checklist:**
- Have ethernet fallback, or confirm `linux-cachyos-lts` is installed as a backup kernel (rtw88 is already built for LTS per `dkms status`).
- After `paru -Syu` with a kernel bump, verify `dkms status` shows rtw88 built for the new kernel *before* rebooting.
- If rebuild fails: `cd /var/lib/dkms/rtw88/0.6 && git pull` (if git-tracked), then `sudo dkms install rtw88/0.6 --force`. Or boot LTS from bootloader.

NVIDIA modules are handled by `linux-cachyos-nvidia-open` (extramodules) — no manual DKMS concerns there.
