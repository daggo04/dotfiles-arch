// Deciding which notifications the sidebar keeps, and which only pop up.

import Notifd from "gi://AstalNotifd"
import { toPlainText } from "./notifMarkup"

/**
 * - keep:       popup, then stays in the sidebar until cleared (the default)
 * - popup-only: popup, then gone — closed in the daemon once the card leaves
 * - hide:       never drawn; closed the moment it arrives
 */
export type NotifKind = "keep" | "popup-only" | "hide"

type Pattern = string | RegExp

type Rule = {
  app?: Pattern
  summary?: Pattern
  body?: Pattern
  category?: Pattern
  action: Exclude<NotifKind, "keep">
}

/**
 * First matching rule wins. Strings match exactly, RegExps anywhere; every
 * field a rule sets has to match. Summary and body are matched as plain text,
 * markup stripped.
 *
 * Notifications you send yourself don't need a rule: pass `notify-send -e`
 * (the freedesktop `transient` hint) and they come out popup-only anyway.
 * This list is for apps that can't be told to.
 *
 *   { app: "Spotify", action: "hide" },
 *   { app: "vivaldi", summary: /^Download complete/, action: "popup-only" },
 */
const RULES: Rule[] = []

function matches(p: Pattern | undefined, value: string): boolean {
  if (p === undefined) return true
  return typeof p === "string" ? p === value : p.test(value)
}

export function classify(notif: Notifd.Notification): NotifKind {
  for (const r of RULES) {
    if (
      matches(r.app, notif.app_name || "") &&
      matches(r.summary, toPlainText(notif.summary)) &&
      matches(r.body, toPlainText(notif.body)) &&
      matches(r.category, notif.category || "")
    ) {
      return r.action
    }
  }
  return notif.transient ? "popup-only" : "keep"
}
