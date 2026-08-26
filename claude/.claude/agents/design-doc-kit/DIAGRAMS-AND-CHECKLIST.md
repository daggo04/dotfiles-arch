# Diagram primitives and the pre-publish checklist

Copy-paste geometry for the two diagram types that come up most, then the list
to run before publishing. Everything here uses the tokens from `base.html`.

## Conventions

- Set `viewBox="0 0 W H"` for the content; let CSS scale it (`svg.chart` already does).
- Text at **11–13px** at the drawn scale. Labels are a word or three; explanation goes in the `<figcaption>`.
- **Align to a grid.** Pick a column pitch and a row pitch and stay on them — even gaps are most of what makes a hand diagram read as deliberate.
- Strokes and text in `currentColor` or a token. Reserve **one** literal accent (`var(--s1)`) for the element that carries the claim: the path being argued about, the convergence, the hop being added.
- Every figure: `<figure>` + `<figcaption>`, and `role="img"` + `aria-label` on the `<svg>` carrying the same claim.
- No `<script>`, `<style>` or `<foreignObject>` inside the SVG.

## Arrowheads

Define once per SVG. Two variants: one inheriting the surrounding colour, one accented.

```html
<defs>
  <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path>
  </marker>
  <marker id="ar-a" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#2a78d6"></path>
  </marker>
</defs>
```

Use `marker-end="url(#ar)"`. Ids are fragment-internal — if two diagrams sit on one page, suffix them (`ar-flow`, `ar-seq`) so they don't collide.

## Flowchart nodes

Keep one row pitch (say 62px) and centre nodes on shared column x-values.

```html
<!-- process box: 130x38 centred on (cx, cy) -->
<rect x="{cx-65}" y="{cy-19}" width="130" height="38" rx="4"
      fill="none" stroke="var(--axis)" stroke-width="1.5"></rect>
<text x="{cx}" y="{cy+4}" text-anchor="middle" font-size="12" fill="var(--ink)">Notify author</text>

<!-- decision diamond: half-width 74, half-height 26 -->
<polygon points="{cx},{cy-26} {cx+74},{cy} {cx},{cy+26} {cx-74},{cy}"
         fill="none" stroke="var(--axis)" stroke-width="1.5"></polygon>
<text x="{cx}" y="{cy+4}" text-anchor="middle" font-size="12" fill="var(--ink)">CI green?</text>

<!-- terminal pill: fully rounded -->
<rect x="{cx-62}" y="{cy-17}" width="124" height="34" rx="17"
      fill="var(--seq-100)" stroke="var(--s1)" stroke-width="2"></rect>
<text x="{cx}" y="{cy+4}" text-anchor="middle" font-size="12" font-weight="600" fill="#0b0b0b">Merge to main</text>
```

A pill filled with `--seq-100` and dark text reads on both grounds, because the
fill is its own surface. Anything relying on the page ground behind it must use
tokens instead.

## Orthogonal connectors

Right-angled routing reads far better than diagonals once there is more than one
edge. Build from a polyline, and label the segment.

```html
<polyline points="{x1},{y1} {x1},{ym} {x2},{ym} {x2},{y2}"
          fill="none" stroke="var(--axis)" stroke-width="1.5"
          marker-end="url(#ar)"></polyline>
<text x="{(x1+x2)/2}" y="{ym-6}" text-anchor="middle" font-size="10.5" fill="var(--muted)">yes</text>
```

**Label every arrow.** An unlabelled arrow means "related somehow". On decision
branches the label is the answer (`yes` / `no` / `&lt; 5%`), not a restatement.

## Sequence diagrams

Participants across the top on a fixed column pitch; lifelines dashed down from
each; messages as horizontal arrows on a fixed row pitch.

```html
<!-- participant head, centred on column x -->
<rect x="{x-50}" y="16" width="100" height="34" rx="4"
      fill="var(--surface)" stroke="var(--axis)" stroke-width="1.5"></rect>
<text x="{x}" y="38" text-anchor="middle" font-size="12" fill="var(--ink)">Builder</text>

<!-- lifeline -->
<line x1="{x}" y1="50" x2="{x}" y2="{bottom}" stroke="var(--axis)"
      stroke-width="1" stroke-dasharray="3 5"></line>

<!-- call (solid) and response (dashed) -->
<line x1="{xa}" y1="{y}" x2="{xb}" y2="{y}" stroke="var(--ink-2)"
      stroke-width="1.5" marker-end="url(#ar)"></line>
<line x1="{xb}" y1="{y}" x2="{xa}" y2="{y}" stroke="var(--muted)"
      stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#ar)"></line>
<text x="{(xa+xb)/2}" y="{y-7}" text-anchor="middle" font-size="10.5" fill="var(--ink-2)">fetch, one job</text>
```

**Self-call loop** — a small rectangle off the lifeline. Give it a real inset so
it never touches an enclosing branch border:

```html
<polyline points="{x},{y} {x+42},{y} {x+42},{y+16} {x},{y+16}"
          fill="none" stroke="var(--ink-2)" stroke-width="1.5"
          marker-end="url(#ar)"></polyline>
```

If the loop sits inside an alt box whose right edge is at `X`, keep
`x + 42 <= X - 8`. Coincident lines read as a rendering bug.

**Alt / branch region** — a bordered box with a corner tab:

```html
<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="none"
      stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 3"></rect>
<path d="M {bx} {by} L {bx} {by+16} L {bx+30} {by+16} L {bx+36} {by} Z"
      fill="var(--surface)" stroke="var(--muted)" stroke-width="1.2"></path>
<text x="{bx+8}" y="{by+12}" font-size="10" fill="var(--muted)">alt</text>
<line x1="{bx}" y1="{ysplit}" x2="{bx+bw}" y2="{ysplit}"
      stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 3"></line>
<text x="{bx+8}" y="{ysplit+13}" font-size="10" fill="var(--muted)">else</text>
```

## Comparing two options

Draw the difference, not two disconnected boxes. Split the canvas with a dashed
rule, run the same structure down both sides, and let the *one edge that differs*
be the thing the reader can point at. Colour only that edge.

---

# Pre-publish checklist

Run this before the final publish. It is the condensed set — the skills remain
authoritative if something here is ambiguous.

**Structure**
- [ ] Source file has **no** `<!doctype>`, `<html>`, `<head>`, `<body>`
- [ ] `<title>` is a real name: short noun phrase, no explainer after a dash or colon
- [ ] Standalone copy regenerated *after* the last edit
- [ ] Every non-void tag closed; attributes double-quoted

**Theme — Monokai Pro (Filter Octagon), single-theme by design**
- [ ] Every colour comes from a token; no raw hex in the markup
- [ ] `body` sets an explicit token `background` — a transparent body borrows the host ground
- [ ] **No** `prefers-color-scheme` block and **no** `[data-theme]` block; there is one mode
- [ ] Forced `prefers-color-scheme: light` renders **identically** — any difference is a leak
- [ ] Sequential ramp starts near the ground (`--seq-100`) so near-zero recedes
- [ ] Monokai accents used only one-at-a-time (links, rules, one highlighted path)
- [ ] Multi-series charts use `--s1`…`--s4`, never the Monokai accents

**Header and file references**
- [ ] Work links present for branch/PR and Asana where they apply
- [ ] No invented URLs, no placeholder hrefs left in
- [ ] Every file path is **relative** to the named root — no absolute paths from your machine
- [ ] File references marked up as `.fileref` with `data-path` (and `data-line` where it helps)
- [ ] The page states which root the paths are relative to, so the reader types the matching one
- [ ] Root picker verified in both states — inert code with no root set, `vscode://` link once set

**Charts**
- [ ] Palette validated in both modes against the actual surfaces
- [ ] Any series under 3:1 has direct labels **or** a table view — and be honest about which you achieved
- [ ] Legend present for two or more series
- [ ] Hover layer on everything except bare stat tiles
- [ ] One y-axis; categorical hues in fixed order
- [ ] Text in text tokens, not series colours
- [ ] No `Math.random()` — the page must render identically every time

**Diagrams**
- [ ] Every arrow labelled
- [ ] `role="img"` + `aria-label` + `figcaption` on every figure
- [ ] No coincident or overlapping strokes

**Content**
- [ ] Synthetic data labelled as such *on the page*, not only in the report
- [ ] Wide content (tables, diagrams, code) inside `.scroller`
- [ ] No invented figures presented as real

**Publish**
- [ ] Updating an existing artifact from a different conversation? Pass its `url` — otherwise you create a duplicate
- [ ] Favicon unchanged from the previous version of this page
- [ ] `label` set to something descriptive
