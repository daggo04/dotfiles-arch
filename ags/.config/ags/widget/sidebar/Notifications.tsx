import { Gtk } from "ags/gtk4"
import Notifd from "gi://AstalNotifd"
import GLib from "gi://GLib"
import cairo from "cairo"
import { onExpandApp } from "../../lib/notifBus"
import { makeNotifIcon } from "../../lib/notifIcon"
import { toPangoMarkup, toPlainText } from "../../lib/notifMarkup"
import {
  DEFAULT_ACTION,
  buttonActions,
  hasDefaultAction,
  invokeAction,
} from "../../lib/notifActions"

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

// ── Single notification card widget ─────────────────
function NotifCard(
  notif: Notifd.Notification,
  onAnimateOut?: (id: number) => void,
  activatable: boolean = false,
): Gtk.Revealer {
  const summary = new Gtk.Label({
    label: toPlainText(notif.summary) || "Notification",
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

  const bodyMarkup = toPangoMarkup(notif.body)
  if (bodyMarkup) {
    const body = new Gtk.Label({
      label: bodyMarkup,
      cssClasses: ["notif-body"],
      halign: Gtk.Align.START,
      xalign: 0,
      wrap: true,
      maxWidthChars: 50,
      useMarkup: true,
    })
    card.append(body)
  }

  const actions = buttonActions(notif)
  if (actions.length > 0) {
    const actionsBox = new Gtk.Box({ spacing: 4, cssClasses: ["notif-actions"] })
    for (const action of actions) {
      const btn = new Gtk.Button({
        cssClasses: ["notif-action-btn"],
        child: new Gtk.Label({ label: action.label }),
      })
      btn.connect("clicked", () => invokeAction(notif, action.id))
      actionsBox.append(btn)
    }
    card.append(actionsBox)
  }

  // The default action lives on the card body, per the spec. Only wired up
  // where a click isn't already spoken for — inside a collapsed stack the
  // click expands the group instead.
  if (activatable && hasDefaultAction(notif)) {
    card.set_cursor_from_name("pointer")
    const activateCtrl = new Gtk.GestureClick()
    activateCtrl.connect("released", () => invokeAction(notif, DEFAULT_ACTION))
    card.add_controller(activateCtrl)
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
function makeFloatingIcon(notif: Notifd.Notification, size: number): Gtk.Box {
  const box = new Gtk.Box({
    halign: Gtk.Align.START,
    valign: Gtk.Align.START,
    marginStart: 2,
    marginTop: 2,
    cssClasses: ["notif-icon-float"],
  })
  box.append(
    makeNotifIcon(notif, size, ["notif-app-icon"], ["notif-app-icon-fallback"]),
  )
  return box
}


// ── Managed app group that updates incrementally ────
class AppStackManager {
  appName: string
  appIcon: string
  expanded: boolean
  widget: Gtk.Box
  dirty: boolean = true
  // Hold the notifications themselves rather than their ids. Looking them up
  // by id meant calling notifd.get_notifications() — which marshals every
  // queued notification across the GI boundary — on every read, including
  // once per side of every comparison in the container's sort.
  private items: Map<number, Notifd.Notification> = new Map()
  private order: Notifd.Notification[] | null = null
  private animatingOut: Set<number> = new Set()

  constructor(appName: string, appIcon: string) {
    this.appName = appName
    this.appIcon = appIcon
    this.expanded = false
    this.widget = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      cssClasses: ["notif-stack-wrapper"],
    })
    this.widget.set_overflow(Gtk.Overflow.VISIBLE)
  }

  /**
   * Newest first. Sorted once per mutation, not once per read.
   *
   * `time` is only second-granular, so a burst of notifications all carry the
   * same stamp and time alone leaves their order to chance. Ids increment, so
   * break ties on those — otherwise a group fronts its oldest card.
   */
  get notifs(): Notifd.Notification[] {
    if (!this.order) {
      this.order = [...this.items.values()].sort(
        (a, b) => b.time - a.time || b.id - a.id,
      )
    }
    return this.order
  }

  get count(): number {
    return this.items.size
  }

  get latestTime(): number {
    const notifs = this.notifs
    return notifs.length > 0 ? notifs[0].time : 0
  }

  get latestId(): number {
    const notifs = this.notifs
    return notifs.length > 0 ? notifs[0].id : 0
  }

  has(id: number): boolean {
    return this.items.has(id)
  }

  addNotif(notif: Notifd.Notification) {
    this.items.set(notif.id, notif)
    this.order = null
    this.dirty = true
  }

  markAnimatingOut(id: number) {
    this.animatingOut.add(id)
  }

  removeNotif(id: number) {
    const wasAnimating = this.animatingOut.delete(id)
    if (!this.items.delete(id)) return
    this.order = null

    // If the revealer already animated this card out in expanded view
    // and there are still 2+ cards, skip the destructive re-render
    if (wasAnimating && this.expanded && this.items.size > 1) {
      return
    }

    // Collapse back to single-card view if only 1 left
    if (this.expanded && this.items.size <= 1) {
      this.expanded = false
    }

    this.dirty = true
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
    const PEEK = 5       // px each slab peeks below the card in front of it
    const MAX_PEEK = 15  // total peek depth limit
    const INSET = 3      // extra side inset per depth level
    const depth = Math.min(notifs.length - 1, Math.floor(MAX_PEEK / PEEK))

    const cardLayer = new Gtk.Overlay()

    // Behind the front card sit plain slabs, not real notification cards.
    // Only the front card is ever visible, so rendering the others was both
    // wasted work and the cause of the overlap: a Gtk.Overlay measures only
    // its main child, so whenever the deepest card happened to be shorter
    // than the front one the stack was under-allocated and the front card
    // painted over the app group below it.
    const slab = (d: number) =>
      new Gtk.Box({
        cssClasses: ["notif-card", "notif-shadow"],
        marginStart: d * INSET,
        marginEnd: d * INSET,
        marginTop: d * PEEK,
        canTarget: false,
      })

    // Deepest slab is the main child: bottom of the z-order, and stretched by
    // the overlay to the full height so its edge lands at the very bottom.
    cardLayer.set_child(slab(depth))

    // Shallower slabs stop short by one PEEK each, giving the stepped edge.
    for (let d = depth - 1; d >= 1; d--) {
      const s = slab(d)
      s.valign = Gtk.Align.FILL
      s.marginBottom = (depth - d) * PEEK
      cardLayer.add_overlay(s)
    }

    // Front card goes on last so it draws above the slabs. measure_overlay is
    // what makes it drive the stack's height; its bottom margin reserves
    // exactly the strip the slabs peek through.
    const front = new Gtk.Overlay({ valign: Gtk.Align.START })
    front.set_overflow(Gtk.Overflow.VISIBLE)
    front.set_child(NotifCard(notifs[0], (id) => this.markAnimatingOut(id)))
    front.add_overlay(makeFloatingIcon(notifs[0], 24))
    front.marginBottom = depth * PEEK

    cardLayer.add_overlay(front)
    cardLayer.set_measure_overlay(front, true)

    // Count badge — bottom-right, clear of the peek strip
    const countBox = new Gtk.Box({
      halign: Gtk.Align.END,
      valign: Gtk.Align.END,
      marginEnd: 16,
      marginBottom: depth * PEEK + 4,
    })
    countBox.append(
      new Gtk.Label({
        label: `${notifs.length}`,
        cssClasses: ["notif-count"],
      }),
    )
    cardLayer.add_overlay(countBox)

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
      const card = NotifCard(notifs[0], onAnimateOut, true)
      const iconBox = makeFloatingIcon(notifs[0], 24)
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

    const icon = makeNotifIcon(
      notifs[0],
      20,
      ["notif-app-icon"],
      ["notif-app-icon-fallback"],
    )

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
      cardsBox.append(NotifCard(n, onAnimateOut, true))
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
      const mgr = new AppStackManager(appName, appIcon)
      stacks.set(appName, mgr)
    }
    return stacks.get(appName)!
  }

  // Rebuilding on every signal made "Clear all" quadratic: dismissing N
  // notifications fired N resolved signals, each re-rendering a stack and
  // re-sorting the whole container. Coalesce instead — the daemon delivers
  // the whole burst before the main loop goes idle, so one rebuild covers it.
  let flushPending = 0
  function scheduleFlush() {
    if (flushPending) return
    flushPending = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      flushPending = 0
      for (const [, mgr] of stacks) {
        if (mgr.dirty && mgr.count > 0) {
          mgr.render()
          mgr.dirty = false
        }
      }
      updateContainerOrder()
      return GLib.SOURCE_REMOVE
    })
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

    // Sort by latest notification, id breaking same-second ties
    const sorted = [...stacks.values()].sort(
      (a, b) => b.latestTime - a.latestTime || b.latestId - a.latestId,
    )
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
    mgr.addNotif(notif)
    scheduleFlush()
  })

  // Handle dismissed/closed notification
  notifd.connect("resolved", (_self: any, id: number) => {
    // Find which stack owns this id and remove it
    for (const [, mgr] of stacks) {
      if (mgr.has(id)) {
        mgr.removeNotif(id)
        break
      }
    }
    scheduleFlush()
  })

  // Bootstrap with existing notifications
  for (const notif of notifd.get_notifications()) {
    const appName = notif.app_name || "Unknown"
    const mgr = getOrCreateStack(appName, notif.app_icon || "")
    mgr.addNotif(notif)
  }
  for (const [, mgr] of stacks) {
    mgr.render()
    mgr.dirty = false
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
