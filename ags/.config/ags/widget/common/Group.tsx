import { Gtk } from "ags/gtk4"

interface GroupProps {
  class?: string
  spacing?: number
  vertical?: boolean
  children?: JSX.Element | JSX.Element[]
}

export default function Group({
  class: className,
  spacing = 8,
  vertical = true,
  children,
}: GroupProps) {
  return (
    <box
      orientation={vertical ? Gtk.Orientation.VERTICAL : Gtk.Orientation.HORIZONTAL}
      spacing={spacing}
      class={`section ${className ?? ""}`}
      hexpand
    >
      {children}
    </box>
  )
}
