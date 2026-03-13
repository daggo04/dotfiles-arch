import { Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import Notifd from "gi://AstalNotifd"
import GLib from "gi://GLib"
import cairo from "cairo"
import { onExpandApp } from "../../lib/notifBus"

const ANIM_DURATION = 200

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    box.remove(child)
    child = next
  }
}

function timeAgo(unixTime: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - unixTime
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function iconNameForApp(appName: string, appIcon: string): string {
  if (appIcon) return appIcon
  return appName.toLowerCase().replace(/\s+/g, "-")
}


// ── Single notification card widget ─────────────────
function NotifCard(notif: Notifd.Notification, onAnimateOut?: (id: number) => void): Gtk.Revealer {
  const summary = new Gtk.Label({
    label: notif.summary || "Notification",
    cssClasses: ["notif-summary"],
    halign: Gtk.Align.START,
    ellipsize: 3,
    hexpand: true,
  })

  const time = new Gtk.Label({
    label: timeAgo(notif.time),
    cssClasses: ["notif-time"],
    valign: Gtk.Align.CENTER,
  })

  const dismissBtn = new Gtk.Button({
    cssClasses: ["icon-button", "notif-dismiss"],
    child: new Gtk.Label({ label: "󰅖" }),
  })
  dismissBtn.connect("clicked", () => {
    if (onAnimateOut) onAnimateOut(notif.id)
    revealer.reveal_child = false
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ANIM_DURATION, () => {
      notif.dismiss()
      return GLib.SOURCE_REMOVE
    })
  })

  const titleRow = new Gtk.Box({ spacing: 4 })
  titleRow.append(summary)
  titleRow.append(time)
  titleRow.append(dismissBtn)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    cssClasses: ["notif-card"],
  })
  card.append(titleRow)

  if (notif.body) {
    const body = new Gtk.Label({
      label: notif.body,
      cssClasses: ["notif-body"],
      halign: Gtk.Align.START,
      wrap: true,
      maxWidthChars: 50,
      useMarkup: false,
    })
    card.append(body)
  }

  const actions = notif.actions
  if (actions && actions.length > 0) {
    const actionsBox = new Gtk.Box({ spacing: 4, cssClasses: ["notif-actions"] })
    for (const action of actions) {
      const btn = new Gtk.Button({
        cssClasses: ["notif-action-btn"],
        child: new Gtk.Label({ label: action.label }),
      })
      btn.connect("clicked", () => notif.invoke(action.id))
      actionsBox.append(btn)
    }
    card.append(actionsBox)
  }

  const revealer = new Gtk.Revealer({
    transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transitionDuration: ANIM_DURATION,
    revealChild: true,
    child: card,
  })

  return revealer
}

// ── Floating app icon helper ────────────────────────
function hasIcon(name: string): boolean {
  const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!)
  return theme.has_icon(name)
}

function makeFloatingIcon(appName: string, appIcon: string, size: number): Gtk.Box {
  const iconName = iconNameForApp(appName, appIcon)
  const useImage = hasIcon(iconName)

  const iconWidget = useImage
    ? new Gtk.Image({
        iconName: iconName,
        pixelSize: size,
        cssClasses: ["notif-app-icon"],
      })
    : new Gtk.Label({
        label: "󱠢",
        cssClasses: ["notif-app-icon-fallback"],
      })

  const box = new Gtk.Box({
    halign: Gtk.Align.START,
    valign: Gtk.Align.START,
    marginStart: 2,
    marginTop: 2,
    cssClasses: ["notif-icon-float"],
  })
  box.append(iconWidget)
  return box
}


// ── Managed app group that updates incrementally ────
class AppStackManager {
  appName: string
  appIcon: string
  notifIds: Set<number> = new Set()
  expanded: boolean
  widget: Gtk.Box
  private notifd: Notifd.Notifd
  private animatingOut: Set<number> = new Set()

  constructor(appName: string, appIcon: string, notifd: Notifd.Notifd) {
    this.appName = appName
    this.appIcon = appIcon
    this.expanded = false
    this.notifd = notifd
    this.widget = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      cssClasses: ["notif-stack-wrapper"],
    })
    this.widget.set_overflow(Gtk.Overflow.VISIBLE)
  }

  get notifs(): Notifd.Notification[] {
    return this.notifd.get_notifications()
      .filter(n => this.notifIds.has(n.id))
      .sort((a, b) => b.time - a.time)
  }

  get count(): number {
    return this.notifIds.size
  }

  get latestTime(): number {
    const notifs = this.notifs
    return notifs.length > 0 ? notifs[0].time : 0
  }

  addNotif(id: number) {
    this.notifIds.add(id)
    this.render()
  }

  markAnimatingOut(id: number) {
    this.animatingOut.add(id)
  }

  removeNotif(id: number) {
    const wasAnimating = this.animatingOut.delete(id)
    this.notifIds.delete(id)

    // If the revealer already animated this card out in expanded view
    // and there are still 2+ cards, skip the destructive re-render
    if (wasAnimating && this.expanded && this.notifIds.size > 1) {
      return
    }

    // Collapse back to single-card view if only 1 left
    if (this.expanded && this.notifIds.size <= 1) {
      this.expanded = false
    }

    this.render()
  }

  render(animate: boolean = false) {
    clearBox(this.widget)
    const notifs = this.notifs

    if (notifs.length === 0) return

    if (notifs.length === 1 || this.expanded) {
      this.renderExpanded(notifs, animate)
    } else {
      this.renderCollapsed(notifs)
    }
  }

  private renderCollapsed(notifs: Notifd.Notification[]) {
    const onDismissTop = (id: number) => this.markAnimatingOut(id)

    const PEEK = 5       // px each card peeks below the one above
    const MAX_PEEK = 15  // total peek depth limit
    const INSET = 3      // extra side margin per depth level
    const maxDepth = Math.min(notifs.length - 1, Math.floor(MAX_PEEK / PEEK))

    // Wrap a card revealer with a floating app icon so the icon
    // is attached to the card and moves with it during animations.
    // Only the top card allows overflow (so its icon extends beyond);
    // deeper cards clip their icons to stay hidden behind the top card.
    const wrapWithIcon = (card: Gtk.Revealer, allowOverflow: boolean = false): Gtk.Overlay => {
      const iconBox = makeFloatingIcon(this.appName, this.appIcon, 24)
      const ov = new Gtk.Overlay()
      if (allowOverflow) ov.set_overflow(Gtk.Overflow.VISIBLE)
      ov.set_child(card)
      ov.add_overlay(iconBox)
      return ov
    }

    // All cards are layered in a single Gtk.Overlay.
    // The deepest visible card is the base (determines total height).
    // Each card is offset down + inset so its bottom edge peeks below
    // the one above. When the top card's revealer collapses, the card
    // beneath is already rendered in place — no layout jump.
    const cardLayer = new Gtk.Overlay()

    // Base: deepest visible card (offset the most, no icon)
    const baseCard = NotifCard(notifs[Math.min(maxDepth, notifs.length - 1)])
    baseCard.set_can_target(false)
    baseCard.marginTop = maxDepth * PEEK
    baseCard.marginStart = maxDepth * INSET
    baseCard.marginEnd = maxDepth * INSET
    cardLayer.set_child(baseCard)

    // Intermediate cards as overlays (deep → shallow)
    // Only the card directly below the top (i=1) gets an icon so it's
    // revealed when the top card slides away. Deeper cards have no icon.
    for (let i = maxDepth - 1; i >= 1; i--) {
      if (i < notifs.length) {
        const rawCard = NotifCard(notifs[i])
        const wrapped = i === 1 ? wrapWithIcon(rawCard) : rawCard
        wrapped.set_can_target(false)
        wrapped.marginTop = i * PEEK
        wrapped.marginStart = i * INSET
        wrapped.marginEnd = i * INSET
        wrapped.valign = Gtk.Align.START
        cardLayer.add_overlay(wrapped)
      }
    }

    // Top card (last overlay = visually on top, overflow visible for icon)
    const topWrapped = wrapWithIcon(NotifCard(notifs[0], onDismissTop), true)
    topWrapped.valign = Gtk.Align.START
    cardLayer.add_overlay(topWrapped)

    // Count badge — pinned to top-right of the top card
    if (notifs.length > 1) {
      const countLabel = new Gtk.Label({
        label: `${notifs.length}`,
        cssClasses: ["notif-count"],
      })
      const countBox = new Gtk.Box({
        halign: Gtk.Align.END,
        valign: Gtk.Align.END,
        marginEnd: 16,
        marginBottom: maxDepth * PEEK + 4,
      })
      countBox.append(countLabel)
      cardLayer.add_overlay(countBox)
    }

    // Click to expand
    const clickCtrl = new Gtk.GestureClick()
    clickCtrl.connect("released", () => {
      this.expanded = true
      this.render(true)
    })
    cardLayer.add_controller(clickCtrl)

    this.widget.append(cardLayer)
  }

  private renderExpanded(notifs: Notifd.Notification[], animate: boolean = false) {
    const onAnimateOut = (id: number) => this.markAnimatingOut(id)

    if (notifs.length === 1) {
      // Single notification with floating icon
      const card = NotifCard(notifs[0], onAnimateOut)
      const iconBox = makeFloatingIcon(this.appName, this.appIcon, 24)
      const overlay = new Gtk.Overlay()
      overlay.set_overflow(Gtk.Overflow.VISIBLE)
      overlay.set_child(card)
      overlay.add_overlay(iconBox)
      this.widget.append(overlay)
      return
    }

    // Header
    const appLabel = new Gtk.Label({
      label: this.appName,
      cssClasses: ["notif-app"],
      halign: Gtk.Align.START,
      hexpand: true,
    })

    const headerIconName = iconNameForApp(this.appName, this.appIcon)
    const icon = hasIcon(headerIconName)
      ? new Gtk.Image({
          iconName: headerIconName,
          pixelSize: 20,
          cssClasses: ["notif-app-icon"],
        })
      : new Gtk.Label({
          label: "󱠢",
          cssClasses: ["notif-app-icon-fallback"],
        })

    const collapseBtn = new Gtk.Button({
      cssClasses: ["icon-button", "notif-collapse-btn"],
      child: new Gtk.Label({ label: "󰅃" }),
      tooltipText: "Collapse",
    })

    const clearStackBtn = new Gtk.Button({
      cssClasses: ["icon-button", "notif-clear-stack-btn"],
      child: new Gtk.Label({ label: "󰅖" }),
      tooltipText: "Clear all from " + this.appName,
    })
    clearStackBtn.connect("clicked", () => {
      for (const n of notifs) {
        n.dismiss()
      }
    })

    const headerRow = new Gtk.Box({ spacing: 6 })
    headerRow.append(icon)
    headerRow.append(appLabel)
    headerRow.append(clearStackBtn)
    headerRow.append(collapseBtn)

    const cardsBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    })
    for (const n of notifs) {
      cardsBox.append(NotifCard(n, onAnimateOut))
    }

    const cardsRevealer = new Gtk.Revealer({
      transitionType: Gtk.RevealerTransitionType.SLIDE_DOWN,
      transitionDuration: ANIM_DURATION,
      revealChild: !animate,
      child: cardsBox,
    })

    collapseBtn.connect("clicked", () => {
      cardsRevealer.reveal_child = false
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, ANIM_DURATION, () => {
        this.expanded = false
        this.render()
        return GLib.SOURCE_REMOVE
      })
    })

    const wrapper = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
    })
    wrapper.append(headerRow)
    wrapper.append(cardsRevealer)

    this.widget.append(wrapper)

    // Trigger reveal animation after widget is mapped
    if (animate) {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
        cardsRevealer.reveal_child = true
        return GLib.SOURCE_REMOVE
      })
    }
  }
}

// ── Main component ──────────────────────────────────
export default function Notifications() {
  const notifd = Notifd.get_default()

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  })

  const emptyLabel = new Gtk.Label({
    label: "No notifications",
    cssClasses: ["notif-empty"],
    halign: Gtk.Align.START,
  })

  const clearBtn = new Gtk.Button({
    cssClasses: ["icon-button", "notif-clear-btn"],
    child: new Gtk.Label({ label: "Clear all" }),
  })
  clearBtn.connect("clicked", () => {
    for (const n of notifd.get_notifications()) {
      n.dismiss()
    }
  })

  // Track app groups by name
  const stacks = new Map<string, AppStackManager>()

  function getOrCreateStack(appName: string, appIcon: string): AppStackManager {
    if (!stacks.has(appName)) {
      const mgr = new AppStackManager(appName, appIcon, notifd)
      stacks.set(appName, mgr)
    }
    return stacks.get(appName)!
  }

  function updateContainerOrder() {
    // Detach all stack widgets, re-append in sorted order
    for (const [, mgr] of stacks) {
      if (mgr.widget.get_parent() === container) {
        container.remove(mgr.widget)
      }
    }

    // Remove empty label if present
    if (emptyLabel.get_parent() === container) {
      container.remove(emptyLabel)
    }

    // Filter out empty stacks
    for (const [key, mgr] of stacks) {
      if (mgr.count === 0) {
        stacks.delete(key)
      }
    }

    if (stacks.size === 0) {
      container.append(emptyLabel)
      clearBtn.visible = false
      return
    }

    clearBtn.visible = true

    // Sort by latest time
    const sorted = [...stacks.values()].sort((a, b) => b.latestTime - a.latestTime)
    for (const mgr of sorted) {
      container.append(mgr.widget)
    }
  }

  // Handle new notification
  notifd.connect("notified", (_self: any, id: number) => {
    const notif = notifd.get_notification(id)
    if (!notif) return

    const appName = notif.app_name || "Unknown"
    const mgr = getOrCreateStack(appName, notif.app_icon || "")
    mgr.addNotif(id)
    updateContainerOrder()
  })

  // Handle dismissed/closed notification
  notifd.connect("resolved", (_self: any, id: number) => {
    // Find which stack owns this id and remove it
    for (const [, mgr] of stacks) {
      if (mgr.notifIds.has(id)) {
        mgr.removeNotif(id)
        break
      }
    }
    updateContainerOrder()
  })

  // Bootstrap with existing notifications
  for (const notif of notifd.get_notifications()) {
    const appName = notif.app_name || "Unknown"
    const mgr = getOrCreateStack(appName, notif.app_icon || "")
    mgr.notifIds.add(notif.id)
  }
  for (const [, mgr] of stacks) {
    mgr.render()
  }
  updateContainerOrder()

  // Layout
  const header = new Gtk.Box({ spacing: 8 })
  const titleLabel = new Gtk.Label({
    label: "Notifications",
    cssClasses: ["notif-header-title"],
    halign: Gtk.Align.START,
    hexpand: true,
  })
  header.append(titleLabel)
  header.append(clearBtn)

  const scrollWin = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  })
  scrollWin.set_child(container)

  // Bottom fade overlay
  const FADE_HEIGHT = 40
  const fadeOverlay = new Gtk.DrawingArea({
    heightRequest: FADE_HEIGHT,
    hexpand: true,
    valign: Gtk.Align.END,
  })
  fadeOverlay.set_can_target(false)
  fadeOverlay.set_draw_func((_area: Gtk.DrawingArea, cr: any, width: number, height: number) => {
    const r = 0x1e / 255, g = 0x1f / 255, b = 0x2b / 255
    const grad = new cairo.LinearGradient(0, 0, 0, height)
    grad.addColorStopRGBA(0, r, g, b, 0)
    grad.addColorStopRGBA(1, r, g, b, 0.95)
    cr.setSource(grad)
    cr.paint()
  })

  const overlay = new Gtk.Overlay({ vexpand: true })
  overlay.set_child(scrollWin)
  overlay.add_overlay(fadeOverlay)

  // Listen for popup click → expand the matching app stack
  onExpandApp((appName) => {
    const mgr = stacks.get(appName)
    if (mgr && mgr.count > 1) {
      mgr.expanded = true
      mgr.render()
    }
  })

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={6} class="notif-section" vexpand>
      {header}
      {overlay}
    </box>
  )
}
