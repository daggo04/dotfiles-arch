// Invoking notification actions, and raising the app that sent them.

import Hyprland from "gi://AstalHyprland"
import Notifd from "gi://AstalNotifd"

export const DEFAULT_ACTION = "default"

/**
 * Actions worth drawing as buttons.
 *
 * The freedesktop spec reserves the "default" action for clicking the
 * notification body — implementations are free not to display it — and apps
 * label it accordingly: Vivaldi sends "Activate", Discord "View", and kitty a
 * single space, which is where the blank button came from. Drop it, and drop
 * blank labels generally.
 */
export function buttonActions(notif: Notifd.Notification): Notifd.Action[] {
  return (notif.actions || []).filter(
    (a) => a.id !== DEFAULT_ACTION && (a.label || "").trim() !== "",
  )
}

export function hasDefaultAction(notif: Notifd.Notification): boolean {
  return (notif.actions || []).some((a) => a.id === DEFAULT_ACTION)
}

function classOf(c: Hyprland.Client): string {
  return (c.get_class() || c.get_initial_class() || "").toLowerCase()
}

/**
 * Raise the window of the app that sent `notif`.
 *
 * astal-notifd exposes no activation-token API, so an app has no token to
 * present when an action is invoked and Wayland's focus-stealing prevention
 * refuses to let it raise itself — Vivaldi opens its settings panel but stays
 * in the background. So do it from the compositor side instead.
 */
export function focusApp(notif: Notifd.Notification): void {
  const hints = [notif.desktop_entry, notif.app_name]
    .map((h) => (h || "").replace(/\.desktop$/i, "").trim().toLowerCase())
    .filter((h) => h.length > 0)
  if (hints.length === 0) return

  let hypr: Hyprland.Hyprland
  let clients: Hyprland.Client[]
  try {
    hypr = Hyprland.get_default()
    clients = hypr.get_clients()
  } catch {
    return // not a Hyprland session; nothing to raise
  }

  let match: Hyprland.Client | undefined
  for (const hint of hints) {
    match = clients.find((c) => classOf(c) === hint)
    if (!match && hint.length >= 3) {
      // "vivaldi-stable" vs "vivaldi", either way round
      match = clients.find((c) => {
        const cls = classOf(c)
        return cls.length >= 3 && (cls.startsWith(hint) || hint.startsWith(cls))
      })
    }
    if (match) break
  }
  if (!match) return

  // AstalHyprland returns the address bare ("55d7f728c310") but the
  // focuswindow dispatcher only accepts the 0x form — without it Hyprland
  // answers "No such window found" and the dispatch fails silently.
  const addr = match.get_address()
  const target = addr.startsWith("0x") ? addr : `0x${addr}`

  try {
    hypr.dispatch("focuswindow", `address:${target}`)
  } catch {
    // window went away between listing and dispatching
  }
}

/** Invoke an action and bring the app forward. */
export function invokeAction(notif: Notifd.Notification, actionId: string): void {
  notif.invoke(actionId)
  focusApp(notif)
}
