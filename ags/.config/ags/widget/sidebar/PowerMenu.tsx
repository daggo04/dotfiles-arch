import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import IconButton from "../common/IconButton"

export default function PowerMenu() {
  return (
    <box class="power-menu" homogeneous spacing={8} hexpand>
      <IconButton
        icon="󰌾"
        tooltip="Lock"
        className="power-lock"
        onClick={() => execAsync("hyprlock")}
      />
      <IconButton
        icon="󰍃"
        tooltip="Logout"
        className="power-logout"
        onClick={() => execAsync("hyprctl dispatch exit")}
      />
      <IconButton
        icon="󰜉"
        tooltip="Reboot"
        className="power-reboot"
        onClick={() => execAsync("systemctl reboot")}
      />
      <IconButton
        icon="󰐥"
        tooltip="Shutdown"
        className="power-shutdown"
        onClick={() => execAsync("systemctl poweroff")}
      />
    </box>
  )
}
