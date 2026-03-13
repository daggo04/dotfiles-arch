import { Astal, Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"

// Color pairs: [light (on trough), dark (on filled)]
const COLORS: Record<string, [number[], number[]]> = {
  cpu: [[0xb2, 0xb9, 0xbd], [0x1e, 0x05, 0x08]],  // bright dimmed -> deep dark red
  mem: [[0xb2, 0xb9, 0xbd], [0x0a, 0x18, 0x05]],  // bright dimmed -> deep dark green
  gpu: [[0xb2, 0xb9, 0xbd], [0x10, 0x05, 0x18]],  // bright dimmed -> deep dark purple
}

function lerpColor(light: number[], dark: number[], t: number): string {
  const c = Math.max(0, Math.min(1, t))
  const r = Math.round(light[0] + (dark[0] - light[0]) * c)
  const g = Math.round(light[1] + (dark[1] - light[1]) * c)
  const b = Math.round(light[2] + (dark[2] - light[2]) * c)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

function gradientMarkup(text: string, fillPct: number, colorKey: string): string {
  const [light, dark] = COLORS[colorKey]
  const chars = [...text]

  // Text is centered, so it spans roughly 30%-70% of the bar width
  // Adjust based on text length
  const textWidth = chars.length * 3.5 // approximate % width per char
  const textStart = 50 - textWidth / 2
  const textEnd = 50 + textWidth / 2

  if (fillPct <= textStart) {
    return `<span foreground="${lerpColor(light, dark, 0)}" weight="bold" size="large">${text}</span>`
  }
  if (fillPct >= textEnd) {
    return `<span foreground="${lerpColor(light, dark, 1)}" weight="bold" size="large">${text}</span>`
  }

  return chars.map((ch, i) => {
    const charPos = chars.length > 1 ? i / (chars.length - 1) : 0.5
    const threshold = textStart + charPos * (textEnd - textStart)
    const blend = 3
    const t = Math.max(0, Math.min(1, (fillPct - (threshold - blend)) / (blend * 2)))
    const color = lerpColor(light, dark, t)
    return `<span foreground="${color}">${ch}</span>`
  }).join("")
    .replace(/^/, '<span weight="bold" size="large">')
    .concat("</span>")
}

interface StatBarProps {
  cssClass: string
  colorKey: string
  pollCmd: string[]
  interval: number
  parseData: (raw: string) => { text: string; pct: number }
}

function StatBar({ cssClass, colorKey, pollCmd, interval, parseData }: StatBarProps) {
  const poll = createPoll("", interval, pollCmd)

  const bar = new Astal.Slider({
    hexpand: true,
    cssClasses: ["slider", "stat-bar", cssClass],
    min: 0,
    max: 1,
    step: 0.01,
    value: 0,
  })
  // Non-interactive display only
  bar.set_can_target(false)
  bar.set_focusable(false)

  const label = new Gtk.Label({
    cssClasses: ["stat-bar-value"],
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    useMarkup: true,
  })
  label.set_can_target(false)

  const overlay = new Gtk.Overlay({ hexpand: true })
  overlay.set_child(bar)
  overlay.add_overlay(label)

  poll.subscribe(() => {
    const raw = poll.get()
    if (!raw) return
    const { text, pct } = parseData(raw)
    bar.value = Math.min(pct / 100, 1)
    label.set_markup(gradientMarkup(text, pct, colorKey))
  })

  return overlay
}

export default function SystemStats() {
  const cpuBar = StatBar({
    cssClass: "stat-cpu",
    colorKey: "cpu",
    interval: 2000,
    pollCmd: ["bash", "-c", `
      freq=$(awk '{sum+=$0; n++} END {printf "%.1f", sum/n/1000}' /proc/cpuinfo <(grep "cpu MHz" /proc/cpuinfo | awk '{print $4}'));
      max=$(lscpu | awk '/CPU max MHz/ {printf "%.1f", $4/1000}');
      pct=$(top -bn1 | grep 'Cpu(s)' | awk '{printf "%.0f", $2}');
      echo "$freq $max $pct"
    `],
    parseData: (raw) => {
      const [freq, max, pct] = raw.trim().split(/\s+/)
      return {
        text: `${freq || "0.0"} / ${max || "5.2"} GHz`,
        pct: parseInt(pct) || 0,
      }
    },
  })

  const memBar = StatBar({
    cssClass: "stat-mem",
    colorKey: "mem",
    interval: 2000,
    pollCmd: ["bash", "-c", "free --mega | awk '/Mem/ {printf \"%.1f %.1f %.0f\", $3/1000, $2/1000, ($3/$2)*100}'"],
    parseData: (raw) => {
      const [used, total, pct] = raw.trim().split(/\s+/)
      return {
        text: `${used || "0.0"} / ${total || "32.0"} GB`,
        pct: parseInt(pct) || 0,
      }
    },
  })

  const gpuBar = StatBar({
    cssClass: "stat-gpu",
    colorKey: "gpu",
    interval: 5000,
    pollCmd: ["bash", "-c", "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits"],
    parseData: (raw) => {
      const parts = raw.trim().split(",").map((s) => s.trim())
      const pct = parseInt(parts[0]) || 0
      const vramUsed = ((parseInt(parts[1]) || 0) / 1024).toFixed(1)
      const vramTotal = ((parseInt(parts[2]) || 0) / 1024).toFixed(1)
      return {
        text: `${vramUsed} / ${vramTotal} GB`,
        pct,
      }
    },
  })

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4} class="system-stats" focusable={false}>
      <box spacing={8}>
        <label label="CPU" class="stat-label" widthChars={4} halign={Gtk.Align.START} />
        {cpuBar}
      </box>
      <box spacing={8}>
        <label label="MEM" class="stat-label" widthChars={4} halign={Gtk.Align.START} />
        {memBar}
      </box>
      <box spacing={8}>
        <label label="GPU" class="stat-label" widthChars={4} halign={Gtk.Align.START} />
        {gpuBar}
      </box>
    </box>
  )
}
