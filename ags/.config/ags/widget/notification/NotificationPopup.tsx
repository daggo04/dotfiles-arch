import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import Notifd from "gi://AstalNotifd"
import GLib from "gi://GLib"
import { emitExpandApp } from "../../lib/notifBus"

const POPUP_TIMEOUT = 5000

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    box.remove(child)
    child = next
  }
}

function iconNameForApp(appName: string, appIcon: string): string {
  if (appIcon) return appIcon
  return appName.toLowerCase().replace(/\s+/g, "-")
}

function hasIcon(name: string): boolean {
  const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!)
  return theme.has_icon(name)
}

function PopupCard(notif: Notifd.Notification, onDone: () => void): Gtk.Box {
  const iconName = iconNameForApp(notif.app_name || "", notif.app_icon || "")
  const useImage = hasIcon(iconName)

  const iconWidget = useImage
    ? new Gtk.Image({
        iconName: iconName,
        pixelSize: 48,
        cssClasses: ["popup-icon"],
        valign: Gtk.Align.CENTER,
      })
    : new Gtk.Label({
        label: "󱠢",
        cssClasses: ["popup-icon-fallback"],
        valign: Gtk.Align.CENTER,
      })

  const appName = new Gtk.Label({
    label: notif.app_name || "",
    cssClasses: ["popup-app"],
    halign: Gtk.Align.START,
  })

  const dismissBtn = new Gtk.Button({
    cssClasses: ["icon-button", "popup-dismiss"],
    child: new Gtk.Label({ label: "󰅖" }),
  })
  dismissBtn.connect("clicked", () => {
    notif.dismiss()
  })

  const headerRow = new Gtk.Box({ spacing: 6 })
  headerRow.append(appName)
  headerRow.append(new Gtk.Box({ hexpand: true }))
  headerRow.append(dismissBtn)

  const summary = new Gtk.Label({
    label: notif.summary || "Notification",
    cssClasses: ["popup-summary"],
    halign: Gtk.Align.START,
    ellipsize: 3,
    hexpand: true,
  })

  const contentBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    hexpand: true,
  })
  contentBox.append(headerRow)
  contentBox.append(summary)

  if (notif.body) {
    const body = new Gtk.Label({
      label: notif.body,
      cssClasses: ["popup-body"],
      halign: Gtk.Align.START,
      wrap: true,
      maxWidthChars: 36,
      useMarkup: false,
    })
    contentBox.append(body)
  }

  const card = new Gtk.Box({
    spacing: 12,
    cssClasses: ["popup-card"],
  })
  card.append(iconWidget)
  card.append(contentBox)

  // Click to open sidebar and expand this app's notification stack
  const clickCtrl = new Gtk.GestureClick()
  clickCtrl.connect("released", () => {
    const sidebar = app.get_window("sidebar")
    if (sidebar) sidebar.visible = true
    emitExpandApp(notif.app_name || "Unknown")
    onDone()
  })
  card.add_controller(clickCtrl)

  // Auto-dismiss after timeout
  const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POPUP_TIMEOUT, () => {
    onDone()
    return GLib.SOURCE_REMOVE
  })

  // If notification is resolved externally, remove popup
  notif.connect("resolved", () => {
    GLib.source_remove(timeoutId)
    onDone()
  })

  return card
}

export default function NotificationPopup() {
  const { TOP, RIGHT } = Astal.WindowAnchor
  const notifd = Notifd.get_default()

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    cssClasses: ["popup-container"],
  })

  const popups: Map<number, Gtk.Box> = new Map()

  function removePopup(id: number) {
    const card = popups.get(id)
    if (card) {
      container.remove(card)
      popups.delete(id)
    }
    win.visible = popups.size > 0
  }

  function addPopup(id: number) {
    // Don't show if sidebar is open
    const sidebar = app.get_window("sidebar")
    if (sidebar?.visible) return

    // Don't show if DND is on
    if (notifd.dont_disturb) return

    const notif = notifd.get_notification(id)
    if (!notif) return

    const card = PopupCard(notif, () => removePopup(id))
    popups.set(id, card)
    container.append(card)
    win.visible = true
  }

  notifd.connect("notified", (_self, id) => {
    addPopup(id)
  })

  notifd.connect("resolved", (_self, id) => {
    removePopup(id)
  })

  const win = (
    <window
      name="notification-popup"
      namespace="notification-popup"
      class="notification-popup"
      visible={false}
      anchor={TOP | RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
      layer={Astal.Layer.OVERLAY}
      keymode={Astal.Keymode.NONE}
      application={app}
    >
      {container}
    </window>
  ) as Astal.Window

  return win
}
