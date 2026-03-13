import { Gtk } from "ags/gtk4"

interface SliderRowProps {
  icon: string
  value: number
  onChanged: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
}

export default function SliderRow({ icon, value, onChanged, min = 0, max = 1, step = 0.01, label }: SliderRowProps) {
  return (
    <box class="slider-row" spacing={8}>
      <label label={icon} class="slider-icon" />
      <slider
        hexpand
        value={value}
        min={min}
        max={max}
        step={step}
        onDragged={(self) => onChanged(self.value)}
        class="slider"
      />
      {label !== undefined && (
        <label
          label={label}
          class="slider-value"
          widthChars={4}
          halign={Gtk.Align.END}
        />
      )}
    </box>
  )
}
