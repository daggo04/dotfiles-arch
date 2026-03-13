import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"

// Light: #888d94 ($dimmed2), Dark: #161821 ($bg-darker)
const LIGHT = [0x88, 0x8d, 0x94]
const DARK = [0x16, 0x18, 0x21]

function lerpColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const r = Math.round(LIGHT[0] + (DARK[0] - LIGHT[0]) * clamped)
  const g = Math.round(LIGHT[1] + (DARK[1] - LIGHT[1]) * clamped)
  const b = Math.round(LIGHT[2] + (DARK[2] - LIGHT[2]) * clamped)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

const COVER_START = 41
const COVER_END = 59

function charThreshold(charIndex: number, totalChars: number): number {
  if (totalChars <= 1) return (COVER_START + COVER_END) / 2
  const t = charIndex / (totalChars - 1)
  return COVER_START + t * (COVER_END - COVER_START)
}

// Slider goes 0–100 where 0 = off (6500K daylight) and 100 = max warmth (2500K)
const TEMP_MAX = 6500
const TEMP_MIN = 2500
const STATE_FILE = GLib.get_user_cache_dir() + "/ags-bluelight"

function tempFromPercent(pct: number): number {
  return Math.round(TEMP_MAX - (pct / 100) * (TEMP_MAX - TEMP_MIN))
}

function saveState(pct: number) {
  try {
    GLib.file_set_contents(STATE_FILE, String(pct))
  } catch (_) {}
}

function loadState(): number {
  try {
    const [ok, contents] = GLib.file_get_contents(STATE_FILE)
    if (ok && contents) {
      const val = parseInt(new TextDecoder().decode(contents))
      if (isFinite(val) && val >= 0 && val <= 100) return val
    }
  } catch (_) {}
  return 0
}

function gradientMarkup(val: number): string {
  const text = `${val}%`
  const chars = [...text]

  if (val <= COVER_START) {
    return `<span foreground="${lerpColor(0)}" weight="bold" size="large">${text}</span>`
  }
  if (val >= COVER_END) {
    return `<span foreground="${lerpColor(1)}" weight="bold" size="large">${text}</span>`
  }

  return chars.map((ch, i) => {
    const threshold = charThreshold(i, chars.length)
    const blend = 3
    const t = Math.max(0, Math.min(1, (val - (threshold - blend)) / (blend * 2)))
    const color = lerpColor(t)
    return `<span foreground="${color}">${ch}</span>`
  }).join("")
    .replace(/^/, '<span weight="bold" size="large">')
    .concat("</span>")
}

export default function BlueLight() {
  let currentValue = loadState()
  let debounceId: number | null = null

  const slider = new Astal.Slider({
    hexpand: true,
    cssClasses: ["slider", "bluelight-slider"],
    min: 0,
    max: 100,
    step: 1,
    value: currentValue,
  })

  const valueLabel = new Gtk.Label({
    cssClasses: ["brightness-value"],
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    useMarkup: true,
  })
  valueLabel.set_can_target(false)

  const iconCool = new Gtk.Label({
    label: "󰖙",
    cssClasses: ["brightness-icon"],
    halign: Gtk.Align.START,
    valign: Gtk.Align.CENTER,
    marginStart: 10,
    useMarkup: true,
  })
  iconCool.set_can_target(false)

  const iconWarm = new Gtk.Label({
    label: "󰖔",
    cssClasses: ["brightness-icon"],
    halign: Gtk.Align.END,
    valign: Gtk.Align.CENTER,
    marginEnd: 10,
    useMarkup: true,
  })
  iconWarm.set_can_target(false)

  function updateLabel(val: number) {
    valueLabel.set_markup(gradientMarkup(val))

    const lowT = Math.max(0, Math.min(1, val / 10))
    iconCool.set_markup(`<span foreground="${lerpColor(lowT)}">󰖙</span>`)

    const highT = Math.max(0, Math.min(1, (val - 90) / 10))
    iconWarm.set_markup(`<span foreground="${lerpColor(highT)}">󰖔</span>`)
  }

  updateLabel(currentValue)

  const overlay = new Gtk.Overlay({ hexpand: true })
  overlay.set_child(slider)
  overlay.add_overlay(valueLabel)
  overlay.add_overlay(iconCool)
  overlay.add_overlay(iconWarm)

  function applyTemp(pct: number) {
    if (debounceId !== null) {
      GLib.source_remove(debounceId)
    }
    debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      debounceId = null
      saveState(pct)
      if (pct <= 0) {
        execAsync(["hyprctl", "hyprsunset", "identity"]).catch(() => {})
      } else {
        const temp = tempFromPercent(pct)
        execAsync(["hyprctl", "hyprsunset", "temperature", String(temp)]).catch(() => {})
      }
      return GLib.SOURCE_REMOVE
    })
  }

  slider.connect("notify::value", () => {
    const val = Math.round(slider.value)
    if (val !== currentValue) {
      currentValue = val
      updateLabel(val)
      applyTemp(val)
    }
  })

  // Apply saved state on startup
  if (currentValue > 0) {
    const temp = tempFromPercent(currentValue)
    execAsync(["hyprctl", "hyprsunset", "temperature", String(temp)]).catch(() => {})
  }

  const container = new Gtk.Box({ hexpand: true, cssClasses: ["brightness"] })
  container.append(overlay)

  return container
}
