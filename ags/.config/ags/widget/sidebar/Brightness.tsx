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
      currentValue = val
      slider.value = val
      updateLabel(val)
    })
    .catch(() => {})

  function applyBrightness(val: number) {
    if (debounceId !== null) {
      GLib.source_remove(debounceId)
    }
    debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      debounceId = null
      execAsync(["ddcutil", "setvcp", "10", String(Math.round(val))])
        .catch(() => {})
      return GLib.SOURCE_REMOVE
    })
  }

  slider.connect("notify::value", () => {
    const val = Math.round(slider.value)
    if (val !== currentValue) {
      currentValue = val
      updateLabel(val)
      applyBrightness(val)
    }
  })

  const container = new Gtk.Box({ hexpand: true, cssClasses: ["brightness"] })
  container.append(overlay)

  return container
}
