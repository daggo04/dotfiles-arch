import { Gtk } from "ags/gtk4"

interface SectionProps {
  title: string
  icon?: string
  headerRight?: JSX.Element
  children?: JSX.Element | JSX.Element[]
}

export default function Section({ title, icon, headerRight, children }: SectionProps) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} class="section">
      <box class="section-header">
        <label
          label={icon ? `${icon}  ${title}` : title}
          class="section-title"
          hexpand
          halign={Gtk.Align.START}
        />
        {headerRight}
      </box>
      <box orientation={Gtk.Orientation.VERTICAL} class="section-content">
        {children}
      </box>
    </box>
  )
}
