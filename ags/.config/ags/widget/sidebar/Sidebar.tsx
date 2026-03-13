import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import Clock from "./Clock"
import Notifications from "./Notifications"
import MediaPlayers from "./MediaPlayers"
import Audio from "./Audio"
import Brightness from "./Brightness"
import BlueLight from "./BlueLight"
import SystemStats from "./SystemStats"
import PowerMenu from "./PowerMenu"

export default function Sidebar() {
  const { TOP, RIGHT, BOTTOM } = Astal.WindowAnchor

  const win = (
    <window
      name="sidebar"
      namespace="sidebar"
      class="sidebar"
      visible={false}
      anchor={TOP | RIGHT | BOTTOM}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
    >
      <box
        class="sidebar-container"
        orientation={Gtk.Orientation.VERTICAL}
        widthRequest={450}
      >
        <Gtk.ScrolledWindow
          vexpand
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
          vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
        >
          <box orientation={Gtk.Orientation.VERTICAL} class="sidebar-content" spacing={12}>
            <box spacing={12}>
              <Clock />
              <box hexpand valign={Gtk.Align.CENTER} orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                <Brightness />
                <BlueLight />
              </box>
            </box>
            <MediaPlayers />
            <Audio />
            <Notifications />
            <SystemStats />
            <PowerMenu />
          </box>
        </Gtk.ScrolledWindow>
      </box>
    </window>
  ) as Astal.Window

  const keyController = new Gtk.EventControllerKey()
  keyController.connect("key-pressed", (_self, keyval) => {
    if (keyval === Gdk.KEY_Escape) {
      win.visible = false
    }
  })
  win.add_controller(keyController)

  return win
}
