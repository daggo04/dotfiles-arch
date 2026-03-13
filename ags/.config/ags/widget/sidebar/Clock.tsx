import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"

export default function Clock() {
  const time = createPoll("", 1000, "date +%H:%M")
  const date = createPoll("", 60000, "date '+%A, %B %d'")

  return (
    <box orientation={Gtk.Orientation.VERTICAL} class="clock" spacing={4}>
      <label label={time} class="clock-time" halign={Gtk.Align.CENTER} />
      <label label={date} class="clock-date" halign={Gtk.Align.CENTER} />
    </box>
  )
}
