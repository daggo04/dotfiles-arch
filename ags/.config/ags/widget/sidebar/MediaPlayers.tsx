import { Astal, Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk"
import GLib from "gi://GLib"
import Mpris from "gi://AstalMpris"
import GdkPixbuf from "gi://GdkPixbuf"
import cairo from "cairo"

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    box.remove(child)
    child = next
  }
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const COVER_HEIGHT = 110
const COVER_MAX_WIDTH = 200

function CoverArt(player: Mpris.Player): Gtk.Widget {
  let currentPixbuf: GdkPixbuf.Pixbuf | null = null

  const drawing = new Gtk.DrawingArea({
    halign: Gtk.Align.CENTER,
  })

  drawing.set_draw_func((_area: Gtk.DrawingArea, cr: any, width: number, height: number) => {
    if (!currentPixbuf || width <= 0 || height <= 0) return

    // Draw image to a temp surface so we can mask it
    const tmp = new cairo.ImageSurface(cairo.Format.ARGB32, width, height)
    const tcr = new cairo.Context(tmp)

    // Scale pixbuf to cover the area
    const imgW = currentPixbuf.get_width()
    const imgH = currentPixbuf.get_height()
    const scale = Math.max(width / imgW, height / imgH)
    const offsetX = (width - imgW * scale) / 2
    const offsetY = (height - imgH * scale) / 2

    tcr.save()
    tcr.translate(offsetX, offsetY)
    tcr.scale(scale, scale)
    Gdk.cairo_set_source_pixbuf(tcr, currentPixbuf, 0, 0)
    tcr.paint()
    tcr.restore()

    // Apply radial alpha mask: DEST_IN keeps image only where gradient is opaque
    tcr.setOperator(cairo.Operator.DEST_IN)
    const cx = width / 2
    const cy = height / 2
    const innerR = Math.min(width, height) * 0.3
    const outerR = Math.max(width, height) * 0.5
    const grad = new cairo.RadialGradient(cx, cy, innerR, cx, cy, outerR)
    grad.addColorStopRGBA(0, 0, 0, 0, 1)     // fully opaque until here
    grad.addColorStopRGBA(1, 0, 0, 0, 0)     // sharp drop to transparent
    tcr.setSource(grad)
    tcr.paint()

    // Paint the masked result onto the widget
    cr.setSourceSurface(tmp, 0, 0)
    cr.paint()
  })

  function updateSize(filePath: string) {
    try {
      const format = GdkPixbuf.Pixbuf.get_file_info(filePath)
      const w = format[1]
      const h = format[2]
      if (w > 0 && h > 0) {
        const aspect = w / h
        const height = COVER_HEIGHT
        const width = Math.min(Math.round(height * aspect), COVER_MAX_WIDTH)
        drawing.set_content_width(width)
        drawing.set_content_height(height)
        return
      }
    } catch (_) {}
    drawing.set_content_width(COVER_HEIGHT)
    drawing.set_content_height(COVER_HEIGHT)
  }

  function updateArt() {
    const path = player.cover_art || ""
    const url = player.art_url || ""
    let filePath = ""
    if (path) filePath = path
    else if (url && url.startsWith("file://")) filePath = url.replace("file://", "")

    if (filePath) {
      try {
        currentPixbuf = GdkPixbuf.Pixbuf.new_from_file(filePath)
      } catch (_) {
        currentPixbuf = null
      }
      updateSize(filePath)
    } else {
      currentPixbuf = null
      drawing.set_content_width(COVER_HEIGHT)
      drawing.set_content_height(COVER_HEIGHT)
    }
    drawing.queue_draw()
  }

  updateArt()
  player.connect("notify::cover-art", updateArt)
  player.connect("notify::art-url", updateArt)

  return drawing
}

function PlayerCard(player: Mpris.Player): Gtk.Box {
  const titleLabel = new Gtk.Label({
    label: player.title || "Unknown",
    cssClasses: ["media-title"],
    halign: Gtk.Align.CENTER,
    ellipsize: 3,
    hexpand: true,
  })

  const artistLabel = new Gtk.Label({
    label: player.artist || "Unknown artist",
    cssClasses: ["media-artist"],
    halign: Gtk.Align.CENTER,
    ellipsize: 3,
    hexpand: true,
  })

  // Progress bar
  const posLabel = new Gtk.Label({
    label: formatTime(player.position),
    cssClasses: ["media-time"],
  })

  const lenLabel = new Gtk.Label({
    label: formatTime(player.length),
    cssClasses: ["media-time"],
  })

  const seekBar = new Astal.Slider({
    hexpand: true,
    cssClasses: ["slider", "media-seek"],
    min: 0,
    max: Math.max(player.length, 1),
    step: 1,
    value: player.position,
  })

  // Seek: guard poll updates so we can tell user-initiated changes apart
  let updatingFromPoll = false

  seekBar.connect("notify::value", () => {
    if (!updatingFromPoll) {
      const val = seekBar.value
      if (isFinite(val) && val >= 0) {
        player.position = val
        posLabel.label = formatTime(val)
      }
    }
  })

  // Poll position every second
  const positionPoll = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
    if (player.playback_status === Mpris.PlaybackStatus.PLAYING) {
      const pos = player.position
      if (isFinite(pos) && pos >= 0) {
        updatingFromPoll = true
        seekBar.value = pos
        posLabel.label = formatTime(pos)
        updatingFromPoll = false
      }
    }
    return GLib.SOURCE_CONTINUE
  })

  // Controls
  const prevBtn = new Gtk.Button({
    cssClasses: ["icon-button", "media-btn"],
    child: new Gtk.Label({ label: "󰒮" }),
    tooltipText: "Previous",
  })
  prevBtn.connect("clicked", () => player.previous())

  const rewindBtn = new Gtk.Button({
    cssClasses: ["icon-button", "media-btn"],
    child: new Gtk.Label({ label: "󰴪" }),
    tooltipText: "Rewind 10s",
  })
  rewindBtn.connect("clicked", () => {
    player.position = Math.max(0, player.position - 10)
  })

  const playPauseLabel = new Gtk.Label({
    label: player.playback_status === Mpris.PlaybackStatus.PLAYING ? "󰏤" : "󰐊",
  })
  const playPauseBtn = new Gtk.Button({
    cssClasses: ["icon-button", "media-btn", "play-pause"],
    child: playPauseLabel,
    tooltipText: "Play/Pause",
  })
  playPauseBtn.connect("clicked", () => player.play_pause())

  const forwardBtn = new Gtk.Button({
    cssClasses: ["icon-button", "media-btn"],
    child: new Gtk.Label({ label: "󰵱" }),
    tooltipText: "Forward 10s",
  })
  forwardBtn.connect("clicked", () => {
    player.position = Math.min(player.length, player.position + 10)
  })

  const nextBtn = new Gtk.Button({
    cssClasses: ["icon-button", "media-btn"],
    child: new Gtk.Label({ label: "󰒭" }),
    tooltipText: "Next",
  })
  nextBtn.connect("clicked", () => player.next())

  const controls = new Gtk.Box({
    spacing: 2,
    halign: Gtk.Align.CENTER,
    cssClasses: ["media-controls"],
  })
  controls.append(prevBtn)
  controls.append(rewindBtn)
  controls.append(playPauseBtn)
  controls.append(forwardBtn)
  controls.append(nextBtn)

  // Layout: title+artist centered, cover art centered below, then progress, controls
  const cover = CoverArt(player)

  const infoBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    hexpand: true,
    spacing: 2,
    halign: Gtk.Align.FILL,
  })
  infoBox.append(titleLabel)
  infoBox.append(artistLabel)

  const infoRow = new Gtk.Box({ spacing: 4 })
  infoRow.append(infoBox)

  const coverBox = new Gtk.Box({ halign: Gtk.Align.CENTER })
  coverBox.append(cover)

  const progressRow = new Gtk.Box({ spacing: 2, cssClasses: ["media-progress"] })
  posLabel.valign = Gtk.Align.CENTER
  lenLabel.valign = Gtk.Align.CENTER
  progressRow.append(posLabel)
  progressRow.append(seekBar)
  progressRow.append(lenLabel)

  const bottomBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
  })
  bottomBox.append(controls)
  bottomBox.append(progressRow)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    cssClasses: ["media-card-content"],
  })
  card.append(infoRow)
  card.append(coverBox)
  card.append(bottomBox)

  // Reactive updates
  player.connect("notify::title", () => {
    titleLabel.label = player.title || "Unknown"
  })
  player.connect("notify::artist", () => {
    artistLabel.label = player.artist || "Unknown artist"
  })
  player.connect("notify::playback-status", () => {
    const playing = player.playback_status === Mpris.PlaybackStatus.PLAYING
    playPauseLabel.label = playing ? "󰏤" : "󰐊"
  })
  player.connect("notify::length", () => {
    const len = player.length
    updatingFromPoll = true
    seekBar.max = Math.max(len, 1)
    lenLabel.label = formatTime(len)
    seekBar.value = player.position
    posLabel.label = formatTime(player.position)
    updatingFromPoll = false
  })
  player.connect("notify::position", () => {
    const pos = player.position
    if (isFinite(pos) && pos >= 0) {
      updatingFromPoll = true
      seekBar.value = pos
      posLabel.label = formatTime(pos)
      updatingFromPoll = false
    }
  })

  return card
}

function iconNameForPlayer(player: Mpris.Player): string {
  const entry = player.entry || ""
  if (entry) return entry.replace(/\.desktop$/, "")
  return (player.identity || "media").toLowerCase().split(" ")[0]
}

export default function MediaPlayers() {
  const mpris = Mpris.Mpris.get_default()

  let activeIndex = 0
  let players: Mpris.Player[] = []
  const tabButtons: Gtk.Button[] = []

  const tabBar = new Gtk.Box({
    spacing: 6,
    halign: Gtk.Align.CENTER,
    cssClasses: ["media-tab-bar"],
  })


  const cardContainer = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
  })

  function findPlayingIndex(): number {
    const idx = players.findIndex(
      (p) => p.playback_status === Mpris.PlaybackStatus.PLAYING
    )
    return idx >= 0 ? idx : 0
  }

  function showPlayer(index: number) {
    activeIndex = index
    clearBox(cardContainer)

    tabButtons.forEach((btn, i) => {
      btn.cssClasses = i === index
        ? ["media-tab", "active"]
        : ["media-tab"]
    })

    if (players.length > 0 && index < players.length) {
      cardContainer.append(PlayerCard(players[index]))
    }
  }

  function rebuild() {
    clearBox(tabBar)
    clearBox(cardContainer)
    tabButtons.length = 0
    players = mpris.get_players()

    if (players.length === 0) {
      cardContainer.append(
        new Gtk.Label({
          label: "No media playing",
          cssClasses: ["media-empty"],
          halign: Gtk.Align.START,
        })
      )
      return
    }

    activeIndex = findPlayingIndex()

    players.forEach((player, i) => {
      const iconName = iconNameForPlayer(player)
      const icon = new Gtk.Image({
        iconName: iconName,
        pixelSize: 22,
      })

      const btn = new Gtk.Button({
        cssClasses: i === activeIndex ? ["media-tab", "active"] : ["media-tab"],
        child: icon,
        tooltipText: player.identity || "Player",
      })

      btn.connect("clicked", () => showPlayer(i))

      tabButtons.push(btn)
      tabBar.append(btn)
    })

    showPlayer(activeIndex)
  }

  mpris.connect("player-added", rebuild)
  mpris.connect("player-closed", rebuild)
  rebuild()

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={0} class="media-section">
      {tabBar}
      {cardContainer}
    </box>
  )
}
