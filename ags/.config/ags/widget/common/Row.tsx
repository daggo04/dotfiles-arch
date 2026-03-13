import { Gtk } from "ags/gtk4"

interface RowProps {
  spacing?: number
  class?: string
  homogeneous?: boolean
  children?: JSX.Element | JSX.Element[]
}

export default function Row({
  spacing = 8,
  class: className,
  homogeneous = false,
  children,
}: RowProps) {
  return (
    <box
      spacing={spacing}
      class={className}
      homogeneous={homogeneous}
      hexpand
    >
      {children}
    </box>
  )
}