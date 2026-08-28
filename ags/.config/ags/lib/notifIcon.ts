// Icon resolution for notifications.
//
// The daemon already does the hard part: image-data hints are decoded and
// written to ~/.cache/astal/notifd/*.png and handed back as `notif.image`.
// Guessing an icon-theme name from app_name only works for native apps —
// browser notifications arrive as "www.messenger.com" and never resolve — so
// try the real image first and fall back through the name-ish sources.

import { Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Notifd from "gi://AstalNotifd"

const FALLBACK_GLYPH = "󱠢"

function themeHas(name: string): boolean {
  if (!name) return false
  const display = Gdk.Display.get_default()
  if (!display) return false
  return Gtk.IconTheme.get_for_display(display).has_icon(name)
}

/** An on-disk path for `v`, or null if it is not a readable local file. */
function localPath(v: string): string | null {
  if (!v) return null

  let p = v
  if (p.startsWith("file://")) {
    try {
      p = GLib.filename_from_uri(p)[0]
    } catch {
      return null
    }
  }
  if (!p.startsWith("/")) return null
  return GLib.file_test(p, GLib.FileTest.EXISTS) ? p : null
}

/**
 * Best available icon widget for `notif`, in preference order:
 * embedded image, app_icon as a file, desktop entry, icon-theme name,
 * then a glyph.
 */
export function makeNotifIcon(
  notif: Notifd.Notification,
  size: number,
  cssClasses: string[],
  fallbackClasses: string[],
): Gtk.Widget {
  const image = notif.image || ""
  const appIcon = notif.app_icon || ""
  const desktop = notif.desktop_entry || ""
  const appName = notif.app_name || ""

  for (const candidate of [image, appIcon]) {
    const path = localPath(candidate)
    if (path) {
      return new Gtk.Image({
        gicon: Gio.FileIcon.new(Gio.File.new_for_path(path)),
        pixelSize: size,
        cssClasses,
        valign: Gtk.Align.CENTER,
      })
    }
  }

  const names = [
    image,
    appIcon,
    desktop,
    desktop.replace(/\.desktop$/i, ""),
    desktop.toLowerCase(),
    appName.toLowerCase().replace(/\s+/g, "-"),
  ]
  for (const name of names) {
    if (themeHas(name)) {
      return new Gtk.Image({
        iconName: name,
        pixelSize: size,
        cssClasses,
        valign: Gtk.Align.CENTER,
      })
    }
  }

  return new Gtk.Label({
    label: FALLBACK_GLYPH,
    cssClasses: fallbackClasses,
    valign: Gtk.Align.CENTER,
  })
}
