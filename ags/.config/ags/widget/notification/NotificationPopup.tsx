import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import Notifd from "gi://AstalNotifd"
import GLib from "gi://GLib"
import { emitExpandApp } from "../../lib/notifBus"
import { classify } from "../../lib/notifFilter"
import { makeNotifIcon } from "../../lib/notifIcon"
import { toPangoMarkup, toPlainText } from "../../lib/notifMarkup"

// How long a popup stays up scales with how much there is to read: a one-word
// "Mic muted" is gone in a moment, a paragraph gets time to be read. 50 ms a
// character is an unhurried ~20 chars/s; the cap covers the body's 6-line
// ellipsis, past which extra text buys nothing.
const POPUP_BASE = 1500
const POPUP_PER_CHAR = 50
const POPUP_MIN = 2500
const POPUP_MAX = 12000

function popupTimeout(notif: Notifd.Notification): number {
  const chars =
    toPlainText(notif.summary).length + toPlainText(notif.body).length
  return Math.min(
    POPUP_MAX,
    Math.max(POPUP_MIN, POPUP_BASE + chars * POPUP_PER_CHAR),
  )
}

type Popup = { card: Gtk.Box; destroy: () => void }

/**
 * The synchronous hint OSD-style senders use (`notify-send -h
 * string:x-canonical-private-synchronous:<key>`): a newer notification with
 * the same key takes over the older one's spot instead of stacking under it.
 */
function syncKey(notif: Notifd.Notification): string | null {
  const v =
    notif.get_hint("x-canonical-private-synchronous") ??
    notif.get_hint("synchronous")
  return v ? String(v.unpack()) : null
}

/**
 * `onDone(resolved)`: resolved is true when the notification was closed from
 * elsewhere, false when the popup itself ended it (timer or click).
 */
function PopupCard(
  notif: Notifd.Notification,
  onDone: (resolved: boolean) => void,
): Popup {
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
    onDone(false)
  })
  card.add_controller(clickCtrl)

  // Auto-dismiss after timeout. Null the id once it fires: the source is
  // already gone by then, and resolving the notification later (the normal
  // case — the popup times out long before you clear it) would otherwise
  // call source_remove on a dead id and log a GLib-CRITICAL.
  let timeoutId: number | null = GLib.timeout_add(
    GLib.PRIORITY_DEFAULT,
    popupTimeout(notif),
    () => {
      timeoutId = null
      onDone(false)
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
    onDone(true)
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
  // sync key → id of the popup currently holding it
  const syncIds: Map<string, number> = new Map()

  function removePopup(id: number) {
    const popup = popups.get(id)
    if (popup) {
      popup.destroy()
      container.remove(popup.card)
      popups.delete(id)
    }
    for (const [key, held] of syncIds) {
      if (held === id) syncIds.delete(key)
    }
    win.visible = popups.size > 0
  }

  function addPopup(id: number) {
    const notif = notifd.get_notification(id)
    if (!notif) return

    // Hidden ones never show. Neither does anything while the sidebar is open
    // or DND is on — and a popup-only notification that can't pop up has
    // nowhere left to be seen, so close it rather than leave it in the daemon.
    const kind = classify(notif)
    const sidebar = app.get_window("sidebar")
    if (kind === "hide" || sidebar?.visible || notifd.dont_disturb) {
      if (kind !== "keep") notif.dismiss()
      return
    }

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

    const sync = syncKey(notif)
    const prev = sync === null ? undefined : syncIds.get(sync)
    if (prev !== undefined) {
      // Retiring the card skips its onDone, so close a popup-only one here.
      const old = notifd.get_notification(prev)
      removePopup(prev)
      if (old && classify(old) === "popup-only") old.dismiss()
    }

    const popup = PopupCard(notif, (resolved) => {
      removePopup(id)
      // A popup-only notification lives as long as its card. Close it in the
      // daemon too, or it lingers there unseen past the next AGS restart.
      if (kind === "popup-only" && !resolved) notif.dismiss()
    })
    popups.set(id, popup)
    if (sync !== null) syncIds.set(sync, id)
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
