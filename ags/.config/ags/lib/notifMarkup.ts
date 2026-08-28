// Pango-safe rendering of notification text.
//
// astal-notifd advertises "body-markup" (and "body-hyperlinks") in
// GetCapabilities, so apps — browsers especially — legitimately send HTML in
// the body. Pango markup is not HTML: it accepts a small tag set, has no
// <br>/<img>/<div>, and fails the *entire* string on a single bare "&",
// leaving the label blank. So translate HTML into the Pango subset instead of
// trusting either side.

import Pango from "gi://Pango"

const PANGO_TAGS = new Set([
  "b", "big", "i", "s", "sub", "sup", "small", "tt", "u", "a", "span",
])

// HTML tags with a direct Pango equivalent
const TAG_ALIASES: Record<string, string> = {
  strong: "b",
  em: "i",
  cite: "i",
  var: "i",
  code: "tt",
  kbd: "tt",
  samp: "tt",
  strike: "s",
  del: "s",
  ins: "u",
}

// Tags whose close should read as a line break
const BLOCK_TAGS = new Set(["p", "div", "li", "tr", "h1", "h2", "h3", "h4"])

const A_ATTRS = new Set(["href", "title"])
const SPAN_ATTRS = new Set([
  "foreground", "background", "fgcolor", "bgcolor", "color", "alpha",
  "font", "font_desc", "font_family", "size", "style", "weight",
  "underline", "strikethrough", "rise", "letter_spacing",
])

// GMarkup knows only the five XML entities plus numeric refs; every other
// named entity is a hard parse error, so fold the HTML ones to real chars.

// HTML4 Latin-1 block — names for U+00A0..U+00FF in codepoint order, so an
// entry's index doubles as its offset. Case is significant here: Eacute and
// eacute are different characters, so lookups must try an exact match first.
const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml".split(
    " ",
  )

const SYMBOLS: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  minus: "−",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  bull: "•",
  dagger: "†",
  Dagger: "‡",
  permil: "‰",
  prime: "′",
  Prime: "″",
  lsaquo: "‹",
  rsaquo: "›",
  euro: "€",
  trade: "™",
  larr: "←",
  uarr: "↑",
  rarr: "→",
  darr: "↓",
  harr: "↔",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
}

const NAMED: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  LATIN1.forEach((name, i) => {
    m[name] = String.fromCharCode(0xa0 + i)
  })
  return Object.assign(m, SYMBOLS)
})()

// Fresh regexes per use — a shared /g literal carries lastIndex between calls.
const tagRe = () => /<\/?[a-zA-Z][^>]*>/g
const entityRe = () => /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g
const attrRe = () => /([a-zA-Z_][a-zA-Z0-9_:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

function decodeEntities(s: string): string {
  return s.replace(entityRe(), (m, ref: string) => {
    if (ref[0] === "#") {
      const cp = ref[1] === "x" || ref[1] === "X"
        ? parseInt(ref.slice(2), 16)
        : parseInt(ref.slice(1), 10)
      if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return m
      try {
        return String.fromCodePoint(cp)
      } catch {
        return m
      }
    }
    return NAMED[ref] ?? NAMED[ref.toLowerCase()] ?? m
  })
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;")
}

function safeHref(v: string): string | null {
  const t = v.trim()
  return /^(https?|mailto|file):/i.test(t) ? t : null
}

function keepAttrs(name: string, tag: string): string {
  const allowed = name === "a" ? A_ATTRS : name === "span" ? SPAN_ATTRS : null
  if (!allowed) return ""

  const parts: string[] = []
  const re = attrRe()
  let a: RegExpExecArray | null
  while ((a = re.exec(tag)) !== null) {
    const key = a[1].toLowerCase()
    if (!allowed.has(key)) continue

    let val = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "")
    if (key === "href") {
      const safe = safeHref(val)
      if (!safe) continue
      val = safe
    }
    parts.push(` ${key}="${escapeAttr(val)}"`)
  }
  return parts.join("")
}

// Emits one tag, keeping the tree balanced: a stray </b> with no matching <b>
// is dropped rather than left to break the parse.
function emitTag(tag: string, out: string[], open: string[]): void {
  const closing = /^<\s*\//.test(tag)
  const nm = tag.match(/^<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/)
  if (!nm) return

  const html = nm[1].toLowerCase()
  if (html === "br") {
    out.push("\n")
    return
  }
  if (html === "img") return
  if (closing && BLOCK_TAGS.has(html)) {
    out.push("\n")
    return
  }

  const name = TAG_ALIASES[html] ?? html
  if (!PANGO_TAGS.has(name)) return

  if (closing) {
    const at = open.lastIndexOf(name)
    if (at === -1) return
    while (open.length > at) out.push(`</${open.pop()}>`)
    return
  }

  const attrs = keepAttrs(name, tag)
  if (name === "a" && !attrs.includes("href=")) return
  out.push(`<${name}${attrs}>`)
  open.push(name)
}

function isValidMarkup(markup: string): boolean {
  try {
    Pango.parse_markup(markup, -1, " ")
    return true
  } catch {
    return false
  }
}

/** Tags and entities out, plain readable text back. */
export function toPlainText(raw: string): string {
  if (!raw) return ""
  return decodeEntities(
    raw
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\/\s*(p|div|li|tr|h[1-4])\s*>/gi, "\n")
      .replace(tagRe(), ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Body text as Pango markup, guaranteed to parse. */
export function toPangoMarkup(raw: string): string {
  if (!raw) return ""

  const out: string[] = []
  const open: string[] = []
  const re = tagRe()
  let last = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(raw)) !== null) {
    out.push(escapeText(decodeEntities(raw.slice(last, m.index))))
    last = m.index + m[0].length
    emitTag(m[0], out, open)
  }
  out.push(escapeText(decodeEntities(raw.slice(last))))
  while (open.length) out.push(`</${open.pop()}>`)

  const markup = out.join("").replace(/\n{3,}/g, "\n\n").trim()

  // Belt and braces: anything that still fails to parse degrades to plain
  // text rather than rendering as an empty label.
  return isValidMarkup(markup) ? markup : escapeText(toPlainText(raw))
}
