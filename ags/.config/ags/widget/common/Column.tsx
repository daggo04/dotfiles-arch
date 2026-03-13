import { Gtk } from "ags/gtk4"

interface ColumnProps {
  spacing?: number
  class?: string
  children?: JSX.Element | JSX.Element[]
}

export default function Column({
  spacing = 8,
  class: className,
  children,
}: ColumnProps) {
  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={spacing}
      class={className}
      hexpand
    >
      {children}
    </box>
  )
}