import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

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

// Slider % at which each character gets covered by the highlight.
// Measured for 3-char text (e.g. "47%") centered on the slider.
// For other lengths, we interpolate between the same start/end range.
const COVER_START = 41  // below this, nothing covered
const COVER_END = 59    // above this, everything covered

function charThreshold(charIndex: number, totalChars: number): number {
  // Map character position to a threshold between COVER_START and COVER_END
  if (totalChars <= 1) return (COVER_START + COVER_END) / 2
  const t = charIndex / (totalChars - 1)
  return COVER_START + t * (COVER_END - COVER_START)
}

// sun-adapt writes this file too, so it is the shared source of truth for
// "what is the monitor actually set to". brightness-get / waybar read it.
const STATE_FILE = GLib.get_user_cache_dir() + "/monitor-brightness"

function saveState(val: number) {
  try {
    GLib.file_set_contents(STATE_FILE, `${val}\n`)
  } catch (_) {}
}

function loadState(): number | null {
  try {
    const [ok, contents] = GLib.file_get_contents(STATE_FILE)
    if (ok && contents) {
      const val = parseInt(new TextDecoder().decode(contents).trim())
      if (isFinite(val) && val >= 0 && val <= 100) return val
    }
  } catch (_) {}
  return null
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
    // Sharp transition: ~3% blend zone around each char's threshold
    const blend = 3
    const t = Math.max(0, Math.min(1, (val - (threshold - blend)) / (blend * 2)))
    const color = lerpColor(t)
    return `<span foreground="${color}">${ch}</span>`
  }).join("")
    .replace(/^/, '<span weight="bold" size="large">')
    .concat("</span>")
}

export default function Brightness() {
  let currentValue = 40
  let debounceId: number | null = null
  let syncing = false

  const slider = new Astal.Slider({
    hexpand: true,
    cssClasses: ["slider", "brightness-slider"],
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

  const iconLow = new Gtk.Label({
    label: "󰃞",
    cssClasses: ["brightness-icon"],
    halign: Gtk.Align.START,
    valign: Gtk.Align.CENTER,
    marginStart: 10,
    useMarkup: true,
  })
  iconLow.set_can_target(false)

  const iconHigh = new Gtk.Label({
    label: "󰃠",
    cssClasses: ["brightness-icon"],
    halign: Gtk.Align.END,
    valign: Gtk.Align.CENTER,
    marginEnd: 10,
    useMarkup: true,
  })
  iconHigh.set_can_target(false)

  function updateLabel(val: number) {
    valueLabel.set_markup(gradientMarkup(val))

    const lowT = Math.max(0, Math.min(1, val / 10))
    iconLow.set_markup(`<span foreground="${lerpColor(lowT)}">󰃞</span>`)

    const highT = Math.max(0, Math.min(1, (val - 90) / 10))
    iconHigh.set_markup(`<span foreground="${lerpColor(highT)}">󰃠</span>`)
  }

  updateLabel(currentValue)

  const overlay = new Gtk.Overlay({ hexpand: true })
  overlay.set_child(slider)
  overlay.add_overlay(valueLabel)
  overlay.add_overlay(iconLow)
  overlay.add_overlay(iconHigh)

  execAsync(["ddcutil", "getvcp", "10", "--brief"])
    .then((out) => {
      const parts = out.trim().split(/\s+/)
      const val = parseInt(parts[3]) || 40
      syncing = true
      currentValue = val
      slider.value = val
      updateLabel(val)
      saveState(val)
      syncing = false
    })
    .catch(() => {})

  function applyBrightness(val: number) {
    if (debounceId !== null) {
      GLib.source_remove(debounceId)
    }
    debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      debounceId = null
      const rounded = Math.round(val)
      saveState(rounded)
      execAsync(["ddcutil", "setvcp", "10", String(rounded)])
        .catch(() => {})
      return GLib.SOURCE_REMOVE
    })
  }

  slider.connect("notify::value", () => {
    const val = Math.round(slider.value)
    if (val !== currentValue) {
      currentValue = val
      updateLabel(val)
      if (!syncing) applyBrightness(val)
    }
  })

  // sun-adapt moves brightness on its own schedule; follow it so the slider
  // never shows a stale value when the sidebar opens.
  const monitor = Gio.File.new_for_path(STATE_FILE)
    .monitor_file(Gio.FileMonitorFlags.NONE, null)
  monitor.connect("changed", () => {
    const val = loadState()
    if (val === null || val === currentValue) return
    syncing = true
    currentValue = val
    slider.value = val
    updateLabel(val)
    syncing = false
  })

  const container = new Gtk.Box({ hexpand: true, cssClasses: ["brightness"] })
  container.append(overlay)
  ;(container as any)._brightnessMonitor = monitor  // keep alive past GC

  return container
}
