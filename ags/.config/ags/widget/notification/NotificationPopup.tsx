import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import Notifd from "gi://AstalNotifd"
import GLib from "gi://GLib"
import { emitExpandApp } from "../../lib/notifBus"
import { makeNotifIcon } from "../../lib/notifIcon"
import { toPangoMarkup, toPlainText } from "../../lib/notifMarkup"

const POPUP_TIMEOUT = 5000

type Popup = { card: Gtk.Box; destroy: () => void }

function PopupCard(notif: Notifd.Notification, onDone: () => void): Popup {
  const iconWidget = makeNotifIcon(
    notif,
    48,
    ["popup-icon"],
    ["popup-icon-fallback"],
  )

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
    label: toPlainText(notif.summary) || "Notification",
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

  const bodyMarkup = toPangoMarkup(notif.body)
  if (bodyMarkup) {
    const body = new Gtk.Label({
      label: bodyMarkup,
      cssClasses: ["popup-body"],
      halign: Gtk.Align.START,
      xalign: 0,
      wrap: true,
      maxWidthChars: 36,
      lines: 6,
      ellipsize: 3,
      useMarkup: true,
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

  // Auto-dismiss after timeout. Null the id once it fires: the source is
  // already gone by then, and resolving the notification later (the normal
  // case — the popup times out long before you clear it) would otherwise
  // call source_remove on a dead id and log a GLib-CRITICAL.
  let timeoutId: number | null = GLib.timeout_add(
    GLib.PRIORITY_DEFAULT,
    POPUP_TIMEOUT,
    () => {
      timeoutId = null
      onDone()
      return GLib.SOURCE_REMOVE
    },
  )

  // Tear down this card's own timer and signal handler. Idempotent, because
  // every path out of a popup ends here: the timer, the resolved signal, a
  // click, and being replaced by a newer version of the same notification.
  let resolvedId: number | null = null
  function destroy() {
    if (timeoutId !== null) {
      GLib.source_remove(timeoutId)
      timeoutId = null
    }
    if (resolvedId !== null) {
      notif.disconnect(resolvedId)
      resolvedId = null
    }
  }

  // If notification is resolved externally, remove popup
  resolvedId = notif.connect("resolved", () => {
    destroy()
    onDone()
  })

  return { card, destroy }
}

export default function NotificationPopup() {
  const { TOP, RIGHT } = Astal.WindowAnchor
  const notifd = Notifd.get_default()

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    cssClasses: ["popup-container"],
  })

  const popups: Map<number, Popup> = new Map()

  function removePopup(id: number) {
    const popup = popups.get(id)
    if (popup) {
      popup.destroy()
      container.remove(popup.card)
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

    // An app reusing replaces_id — Messenger in a browser does it for every
    // new message in a thread — makes the daemon emit `notified` again with
    // the same id. Retire the card already on screen for it first. Otherwise
    // popups.set() below drops the map's only reference to that widget while
    // it stays parented in the container, so nothing can ever remove it: it
    // sits there for the rest of the session and reappears every time a later
    // notification turns the window visible again. Its still-armed timer
    // would also fire onDone() for this id and take the new card down early,
    // which destroy() now prevents.
    removePopup(id)

    const popup = PopupCard(notif, () => removePopup(id))
    popups.set(id, popup)
    container.append(popup.card)
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
