// Spaces as one tree, replacing the separate Spaces and Agents lists:
//
//   Space                      (header: avatar, name; click folds, right-click = space menu)
//     Session title            (a tab, named after its agent's live title; click focuses it)
//       ├ sub-agent            (terminals the agent started with `hc run`)
//       └ terminal             (the tab's other panes, each with its own sub-agents)
//
// The space goes without saying under its header, so agents don't need it in their name.
// Pieces borrowed from the shipped `spaces` and `agents` mods (avatars, status marks, tree lines).

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, terminals, agents, focused, run, theme, shared, setShared, setAgentOrder, openOverlay, layout, home } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, like the shipped mods.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function expandSidebar() {
  setShared("sidebar.collapsed", false);
  run("layout.resize", { id: "sidebar", px: shared("sidebar.width") ?? 268 });
}

// Avatar colors: the same table and stored picks (`space.colors`) as the spaces mod.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const PALETTE = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];

// Leading emoji/symbols off: "⚙️ System" -> "System" (the avatar already shows the emoji).
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
const tilde = (p) => {
  const h = home();
  return p && h && (p === h || p.startsWith(h + "/")) ? "~" + p.slice(h.length) : p;
};

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const worst = (list) => list.reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// A program's own title, when it says more than the program's name or a path.
function telling(p) {
  const prog = p?.program?.name;
  const live = clean(p?.title);
  const ok = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== p?.program?.key;
  return ok ? live : null;
}

// What a pane is called on its own row.
// A bare shell goes by its folder (fish's own title is "dir - fish"); a program in front of it by its title.
const paneName = (p) => (p.program?.shell ? tilde(p.cwd) || p.program?.name : telling(p) ?? p.program?.name) ?? "terminal";

// The session's title: a name someone gave the tab wins, then its agent's title.
function sessionTitle(tab, lead) {
  if (tab.named) return tab.name;
  if (!lead) return `Tab ${tab.name}`;
  return paneName(lead);
}

// A sub-agent without a pane: its raw word, error counting as blocked. Never done:
// it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};

export default class SpaceTree extends View {
  init(_props, cx) {
    this.folded = new Set(JSON.parse(localStorage.getItem("folded") ?? "[]"));
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("ages") ?? "{}");
    this.hovered = null;
    this.pressed = null; // space being dragged
    this.over = null; // space group under the pointer while dragging
    this.started = Date.now();
    cx.timer.every(30000, (cx) => cx.notify()); // the "5m" ages
  }

  toggle(id, cx) {
    this.folded.has(id) ? this.folded.delete(id) : this.folded.add(id);
    localStorage.setItem("folded", JSON.stringify([...this.folded]));
    cx.notify();
  }

  // Done and idle count as one: looking at a finished agent turns done into idle.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      const prev = this.changed[a.address];
      if (prev?.s === s) continue;
      // First sight right after starting: when it changed is unknown, so no age (0) rather than a false "<1m".
      this.changed[a.address] = { s, at: !prev && now - this.started < 5000 ? 0 : now };
      dirty = true;
    }
    if (!dirty) return;
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("ages", JSON.stringify(this.changed));
  }

  // Status at a glance. Full: a labelled pill (sessions). Compact: an icon (sub-agents,
  // folded headers, the rail). Idle stays a quiet ring: it's the state that needs nothing.
  status(t, s, compact = false) {
    const spin = (n) => svg("mods/workspace-chrome/spinner.svg").size(n).flex_none().text_color(t.working).spin(900);
    if (compact) {
      if (s === "working") return div().size(16).flex_none().flex().items_center().justify_center().child(spin(13));
      if (s === "blocked") return div().size(16).flex_none().rounded(4).bg(t.blocked + "33").text_size(11).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
      if (s === "done") return div().size(16).flex_none().flex().items_center().justify_center().child(svg("mods/workspace-chrome/circle-check.svg").size(14).text_color(t.done));
      if (s === "idle") return div().size(16).flex_none().flex().items_center().justify_center().child(div().size(8).rounded(4).border(1.5).border_color(t.idle ?? t.dim));
      return div().size(16).flex_none();
    }
    const pill = (color, label, lead) => h_flex().flex_none().gap(4).px(7).h(19).rounded(6).items_center()
      .bg(color + "2e").text_size(10.5).font_semibold().text_color(color)
      .when(Boolean(lead), (el) => el.child(lead)).child(label);
    if (s === "working") return pill(t.working, "Working", spin(11));
    if (s === "blocked") return pill(t.blocked, "Needs you");
    if (s === "done") return pill(t.done, "Done");
    if (s === "idle") return div().size(8).mx(4).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(8).mx(4).flex_none(); // a plain terminal: room kept, nothing drawn
  }

  // interactive: its own click folds (sessions). A space header folds on its own click.
  chevron(t, id, open, count, top, interactive = true) {
    return div()
      .id(`fold-${id}`)
      .h(18)
      .px(3)
      .gap(3)
      .flex()
      .flex_none()
      .items_center()
      .rounded(4)
      .text_size(11)
      .text_color(open ? t.dim : (t[top] ?? t.dim))
      .when(interactive, (el) => el
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.toggle(id, cx);
        }))
      .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
      .when(!open && count > 0, (el) => el.child(String(count)));
  }

  // ── Space header ─────────────────────────────────────────────
  spaceRow(t, s, fill, sessions) {
    const open = !this.folded.has(s.id);
    const hov = this.hovered === `sp-${s.id}`;
    const top = worst(sessions.flatMap((x) => x.statuses));
    const name = clean(s.name) || s.name;
    return h_flex()
      .id(`sp-${s.id}`)
      .h(28)
      .mt(6)
      .px(8)
      .gap(8)
      .flex_none()
      .items_center()
      .rounded(7)
      .cursor_pointer()
      .hover((el) => el.bg(t.hover))
      .on_hover((on, cx) => {
        if (on) this.hovered = `sp-${s.id}`;
        else if (this.hovered === `sp-${s.id}`) this.hovered = null;
        cx.notify();
      })
      // Press starts a possible drag; release on the header itself is a click: fold.
      // (A release over another space's group is handled by that group: a move.)
      .on_mouse_down("left", () => {
        this.pressed = s.id;
        this.over = s.id;
      })
      .on_mouse_up("left", (_e, cx) => {
        if (this.pressed === s.id && this.over === s.id) {
          this.pressed = null;
          this.over = null;
          this.toggle(s.id, cx);
        }
      })
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }))
      .child(h_flex().size(16).flex_none().rounded(4).bg(fill).items_center().justify_center().text_size(9.5).font_bold().text_color("#ffffff").child([...s.name][0]?.toUpperCase() ?? "?"))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).font_semibold().text_color(s.active ? t.foreground : t.muted).child(name))
      .when(Boolean(s.machine), (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(s.machine)))
      .when(hov, (el) => el.child(div()
        .id(`sp-new-${s.id}`)
        .size(18)
        .flex_none()
        .flex()
        .items_center()
        .justify_center()
        .rounded(4)
        .text_color(t.dim)
        .hover((x) => x.bg(t.hover).text_color(t.foreground))
        .tooltip("New tab here")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation()) // not a drag, not a fold
        .on_mouse_up("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("tab.new", { space: s.id });
        })
        .child(svg("mods/workspace-chrome/plus.svg").size(12))))
      .when(!open && top && top !== "idle", (el) => el.child(this.status(t, top, true)))
      .child(this.chevron(t, s.id, open, open ? 0 : sessions.length, top, false));
  }

  // A space's header and sessions together: the drop target while dragging a space.
  group(t, s, i, children) {
    const fromIndex = this.pressed ? spaces().findIndex((x) => x.id === this.pressed) : -1;
    const dragging = this.pressed !== null && this.over !== this.pressed;
    return v_flex()
      .relative()
      .id(`grp-${s.id}`)
      .flex_none()
      .when(dragging && this.pressed === s.id, (el) => el.opacity(0.5))
      .when(dragging && this.over === s.id && this.pressed !== s.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).rounded(1).bg(t.accent)
          .when(fromIndex < i, (line) => line.bottom(0))
          .when(fromIndex > i, (line) => line.top(4)),
      ))
      .on_mouse_move((_e, cx) => {
        if (this.pressed === null) return;
        const source = spaces().find((x) => x.id === this.pressed);
        // Spaces move only within their machine.
        const over = source && (source.machine ?? null) === (s.machine ?? null) ? s.id : null;
        if (this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from && over === s.id && from !== s.id) {
          const index = spaces().findIndex((x) => x.id === s.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        }
        cx.notify();
      })
      .children(children);
  }

  // ── Session (a tab) ──────────────────────────────────────────
  sessionRow(t, s, x, now) {
    const { tab, lead, kids } = x;
    const open = !this.folded.has(tab.id);
    const on = focused()?.tab === tab.id;
    const st = lead?.status ?? null;
    const idle = (!st || st === "idle") && !on;
    const pic = lead ? icon(lead.program, 16, t.foreground) : svg("mods/workspace-chrome/terminal.svg").size(16).flex_none().text_color(t.muted);
    const when = lead?.terminal && this.changed[lead.terminal]?.at;
    const top = worst(kids.map((k) => k.status));
    // Loud states tint the row and get a bar down its left edge.
    const loud = st === "blocked" || st === "done";
    const bar = st && st !== "idle" ? t[st] : null;
    return h_flex()
      .relative()
      .id(`tab-${tab.id}`)
      .h(30)
      .ml(20) // indented under its space: icon lines up with the space name
      .pl(12)
      .pr(8)
      .gap(9)
      .flex_none()
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .when(loud && !on, (el) => el.bg(t[st] + "14"))
      .when(on, (el) => el.bg(t.selected))
      .hover((el) => el.bg(t.hover))
      .when(Boolean(bar), (el) => el.child(div().absolute().left(3).top(7).bottom(7).w(3).rounded(2).bg(bar)))
      .on_click(() => (lead ? run("pane.focus", { pane: lead.pane }) : (run("space.select", { id: s.id }), run("tab.select", { id: tab.id }))))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 160, props: { tab: "tab", target: { id: tab.id, space: s.id } } }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_1().min_w(0).truncate().text_color(idle ? t.muted : t.foreground).child(sessionTitle(tab, lead)))
      .when(kids.length > 0, (el) => el.child(this.chevron(t, tab.id, open, kids.length, top)))
      .when(Boolean(when) && Boolean(st), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(now - when))))
      .child(this.status(t, st));
  }

  // ── Children: sub-agents and the tab's other terminals ───────
  kidRow(t, k) {
    const on = focused()?.terminal === k.address;
    const pic = icon(k.program, 14, t.foreground) ?? svg("mods/workspace-chrome/terminal.svg").size(14).flex_none().text_color(t.dim);
    return h_flex()
      .id(`kid-${k.key}`)
      .h(26)
      .ml(20)
      .pl(20) // tree lines hang from the session icon's centre
      .pr(8)
      .flex_none()
      .items_center()
      .rounded(8)
      .text_size(12.5)
      .cursor_pointer()
      .when(on, (el) => el.bg(t.raised))
      .hover((el) => el.bg(t.hover))
      .on_click(() => (k.pane ? run("pane.focus", { pane: k.pane }) : run("terminal.peek", { terminal: k.address })))
      .when(Boolean(k.pane), (el) => el.on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 220, height: 260, props: { tab: "pane", target: { pane: k.pane, terminal: k.address } } })))
      .children(k.lines.map((l) => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
        .when(Boolean(l), (el) => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", (el) => el.border_b(1.5).rounded_bl(6))))
      .child(div().mr(8).child(pic))
      .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(k.name))
      .child(this.status(t, k.status, true));
  }

  // The tree under one session, flattened with the lines in front of each row.
  sessions(s, ps, all, listed) {
    const byTerminal = new Set(ps.map((p) => p.terminal).filter(Boolean));
    // Sub-agents of `addr`; one given a pane (terminal.keep) shows as a pane instead.
    const subs = (addr) => all
      .filter((k) => k.parent === addr && k.state === "live" && !byTerminal.has(k.address))
      .map((k) => ({
        key: k.address,
        address: k.address,
        pane: null,
        name: k.name || k.template || k.program?.name || k.address,
        status: kidStatus(k, listed),
        kids: subs(k.address),
      }));
    const flat = (nodes, lead = []) => nodes.flatMap((n, i) => {
      const last = i === nodes.length - 1;
      return [{ ...n, lines: [...lead, last ? "└" : "├"] }, ...flat(n.kids, [...lead, last ? "" : "│"])];
    });

    return s.tabs.map((tab) => {
      const mine = ps.filter((p) => p.tab === tab.id && p.terminal);
      // The session's face: its first agent, else its focused terminal, else its first.
      const lead = mine.find((p) => p.program?.agent || p.status) ?? mine.find((p) => p.focused) ?? mine[0] ?? null;
      const others = mine.filter((p) => p !== lead).map((p) => ({
        key: p.pane,
        address: p.terminal,
        pane: p.pane,
        name: paneName(p),
        status: p.status,
        kids: subs(p.terminal),
      }));
      const kids = flat([...(lead ? subs(lead.terminal) : []), ...others]);
      const statuses = [lead?.status, ...kids.map((k) => k.status)].filter(Boolean);
      return { tab, lead, kids, statuses };
    });
  }

  // ── The narrow rail: an avatar per space, a mark per session ──
  rail(t, tree) {
    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .text_size(12)
      .child(v_flex().id("st-rail").flex_1().min_h(0).overflow_y_scrollbar().children(tree.flatMap(({ s, fill, sessions }) => [
        h_flex().id(`rail-sp-${s.id}`).h(28).mt(4).flex_none().justify_center().items_center()
          .on_click(() => run("space.select", { id: s.id }))
          .child(h_flex().size(18).rounded(5).bg(fill).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...s.name][0]?.toUpperCase() ?? "?")),
        ...sessions.map((x) => h_flex().id(`rail-tab-${x.tab.id}`).h(22).flex_none().justify_center().items_center()
          .when(focused()?.tab === x.tab.id, (el) => el.bg(t.raised))
          .hover((el) => el.bg(t.hover))
          .on_click(() => (x.lead ? run("pane.focus", { pane: x.lead.pane }) : run("tab.select", { id: x.tab.id })))
          .child(this.status(t, worst(x.statuses) ?? (x.lead ? null : null), true))),
      ])))
      .child(h_flex().h(28).items_center().justify_center()
        .child(div().id("st-expand").text_size(13).text_color(t.dim).hover((el) => el.text_color(t.foreground)).on_click(expandSidebar).child("»")));
  }

  render() {
    const t = theme();
    const sp = spaces();
    const ps = panes();
    const all = terminals();
    const ag = agents();
    const listed = new Map(ag.map((a) => [a.address, a.status]));
    const now = Date.now();
    this.track(ag, now);

    // Avatar colors, shared with the spaces mod: new spaces get the least-used one.
    const ids = new Set(sp.map((p) => p.id));
    const stored = shared("space.colors") ?? {};
    const kept = Object.fromEntries(Object.entries(stored).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(stored).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = (c) => Object.values(kept).filter((v) => v === c).length;
      kept[p.id] = PALETTE.reduce((best, c) => (uses(c) < uses(best) ? c : best));
      changed = true;
    }
    if (changed) setShared("space.colors", kept);

    const tree = sp.map((s) => {
      const color = kept[s.id] ?? "ansi6";
      const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
      return { s, fill, sessions: this.sessions(s, ps, all, listed) };
    });

    // agent.next / agent.prev walk the tree top to bottom.
    const agentSet = new Set(ag.map((a) => a.address));
    setAgentOrder(tree.flatMap(({ sessions }) => sessions.flatMap((x) => [x.lead?.terminal, ...x.kids.map((k) => k.address)])).filter((a) => a && agentSet.has(a)));

    if (narrow()) return this.rail(t, tree);

    const rows = tree.map(({ s, fill, sessions }, i) => {
      const head = this.spaceRow(t, s, fill, sessions);
      const body = this.folded.has(s.id) ? [] : sessions.flatMap((x) => {
        const row = this.sessionRow(t, s, x, now);
        return this.folded.has(x.tab.id) ? [row] : [row, ...x.kids.map((k) => this.kidRow(t, k))];
      });
      return this.group(t, s, i, [head, ...body]);
    });

    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .text_size(13)
      .child(h_flex().h(31).pl(16).pr(10).flex_none().items_center().justify_between().text_size(11.5).text_color(t.dim)
        .child("Spaces")
        .child(div().id("st-space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6)
          .hover((el) => el.bg(t.hover).text_color(t.foreground))
          .tooltip("New space")
          .on_click(() => run("space.new"))
          .child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .child(v_flex().id("st-list").flex_1().min_h(0).px(8).pb(14).overflow_y_scrollbar().mode("always")
        // Released outside any space: the drag ends where it started.
        .on_mouse_up("left", (_e, cx) => {
          if (this.pressed === null) return;
          this.pressed = null;
          this.over = null;
          cx.notify();
        })
        .children(rows));
  }
}
