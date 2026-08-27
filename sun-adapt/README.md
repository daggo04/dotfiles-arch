# sun-adapt

Tracks the sun over Stavanger and walks the monitor from bright/neutral in the
daytime to dim/warm at night, so you stop having to remember the sidebar sliders.

- **Brightness** goes out over DDC/CI — `ddcutil setvcp 10`, the same path the
  AGS `Brightness` widget uses.
- **Tint** goes out over `hyprctl hyprsunset temperature`, the same path the AGS
  `BlueLight` widget uses.

Both AGS cache files (`~/.cache/monitor-brightness`, `~/.cache/ags-bluelight`)
are kept in sync, so the sidebar sliders track the daemon live rather than
showing whatever you last dragged them to.

## Layout

| Path | What |
|---|---|
| `~/.local/bin/sun-adapt` | the daemon (from the `scripts` Stow package) |
| `~/.config/sun-adapt/config.toml` | latitude, ranges, clamp windows |
| `~/.config/systemd/user/sun-adapt.service` | runs it under `graphical-session.target` |
| `~/.cache/sun-adapt-state.json` | last-applied values, on/off flag, override clock |

The daemon re-reads that state file on every tick, so `pause` / `on` / `off`
from another process (the rofi menu, a shell) take effect on the next tick
instead of being clobbered by the running loop.

## Commands

```sh
sun-adapt status        # sun times, today's ramps, target vs actual
sun-adapt state         # just "on" or "off" (used by the rofi menu)
sun-adapt off           # stop auto-adjusting, persists across reboots
sun-adapt on            # resume and apply immediately
sun-adapt pause 90      # back off for 90 minutes, then resume on its own
sun-adapt resume        # cancel a pause and re-apply
sun-adapt apply         # force the current target right now

systemctl --user restart sun-adapt      # after editing config.toml
journalctl --user -u sun-adapt -f       # watch it work
```

Also in the rofi `Commands` palette (`rofi -show Commands`): turn on/off,
pause 2h, and a status notification. Those entries re-read the live state on
every open, so the menu always offers the action that actually applies.

## Do not use `systemctl --user disable` on this unit

`~/.config/systemd/user/sun-adapt.service` is a **Stow symlink**. systemd treats
a unit file that is a symlink from outside its search path as a *linked* unit,
and `disable` **deletes the symlink** rather than just removing the `.wants`
entry. That silently breaks the Stow package - you get the unit file back with
`stow -R sun-adapt`, but it is a confusing five minutes.

Use `sun-adapt off` instead. The unit keeps running; the daemon just stops
actuating. That is also why the rofi toggle is wired to `sun-adapt on/off`
rather than to systemctl.

To enable it on a fresh machine after `stow sun-adapt`:

```sh
systemctl --user daemon-reload
systemctl --user enable --now sun-adapt.service
```

## How the curve works

A `daylight factor` runs 0.0 (night) to 1.0 (day), eased with a smoothstep so
the ends taper instead of hitting a corner. Brightness and colour temperature are
both linear in that factor.

The ramps are anchored to real solar position (civil twilight at -6°, sunrise and
sunset at -0.833°), computed locally — no network, no API key.

## Why the clamps exist

At 59°N the raw sun times are unusable at the solstices. In June the sun sets at
22:53 and rises at 04:24; in December it rises at 09:29 and sets at 15:40. Pure
sun-tracking would mean full daylight brightness until 23:00 in summer and an
orange screen from 15:00 in winter.

So `[schedule]` clamps the *start* of each ramp into a sane window and enforces a
minimum and maximum ramp length. Sample of what that produces:

```
date          sunrise  sunset |   brighten ramp |       warm ramp
2026-06-21      04:24   22:53 | 06:00 -> 07:00 | 22:08 -> 23:08
2026-08-27      06:23   20:52 | 06:00 -> 07:08 | 20:07 -> 21:36
2026-09-22      07:21   19:36 | 06:40 -> 08:06 | 19:00 -> 20:17
2026-12-21      09:29   15:40 | 08:34 -> 10:14 | 19:00 -> 20:00
```

The winter trade-off is deliberate: the sun is down at 15:40 but the screen stays
bright until 19:00, because going orange mid-afternoon is worse. Drop
`evening_earliest` if you'd rather follow the sun more closely.

Above the Arctic Circle, or any day with no sunrise/sunset at all, every solar
lookup returns nothing and the schedule falls back cleanly to the clamp windows
as a fixed clock schedule.

## Manual override

Move either slider and the daemon notices and backs off for
`override_minutes` (default 120) instead of fighting you, then resumes on its own.

Tint changes are caught on the next tick — the AGS slider rewrites its cache file,
which is free to read. Brightness changes are caught within 5 minutes, since
DDC/CI reads are slow and are throttled while nothing is being written.

Anything else that changes brightness must write `~/.cache/monitor-brightness`
too, or the AGS slider and waybar will show a stale value. That is what
`brightness-step` (used by the rofi Brightness Up/Down entries) is for — the
raw `ddcutil setvcp` calls it replaced did not update the cache.
