import { Astal, Gtk } from "ags/gtk4"
import { createBinding, createEffect } from "gnim"
import Wp from "gi://AstalWp"

function clearBox(box: Gtk.Box) {
  let child = box.get_first_child()
  while (child) {
    const next = child.get_next_sibling()
    box.remove(child)
    child = next
  }
}

function VolumeSlider({ endpoint }: { endpoint: Wp.Endpoint }) {
  const sl = new Astal.Slider({
    hexpand: true,
    cssClasses: ["slider"],
    min: 0,
    max: 1,
    step: 0.01,
    value: endpoint.volume,
  })

  sl.connect("notify::value", () => {
    endpoint.volume = sl.value
  })

  endpoint.connect("notify::volume", () => {
    sl.value = endpoint.volume
  })

  return sl
}

function DeviceDropdown({
  endpoints,
  current,
}: {
  endpoints: Wp.Endpoint[]
  current: Wp.Endpoint
}) {
  const nameLabel = new Gtk.Label({
    label: current.description ?? "Unknown",
    halign: Gtk.Align.START,
    hexpand: true,
    ellipsize: 3,
    cssClasses: ["audio-device-name"],
  })

  const arrow = new Gtk.Label({
    label: "󰅀",
    cssClasses: ["dropdown-arrow"],
  })

  const headerBox = new Gtk.Box({ spacing: 4 })
  headerBox.append(nameLabel)
  headerBox.append(arrow)

  // Build popover content
  const listBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    cssClasses: ["device-popover-list"],
    spacing: 0,
  })

  const popover = new Gtk.Popover({
    child: listBox,
    cssClasses: ["device-popover"],
    hasArrow: false,
  })

  function rebuildList() {
    clearBox(listBox)
    for (const ep of endpoints) {
      const item = new Gtk.Button({
        cssClasses: ep.is_default ? ["device-item", "active"] : ["device-item"],
        child: new Gtk.Label({
          label: ep.description ?? "Unknown",
          halign: Gtk.Align.START,
          hexpand: true,
          ellipsize: 3,
        }),
      })
      item.connect("clicked", () => {
        ep.is_default = true
        nameLabel.label = ep.description ?? "Unknown"
        popover.popdown()
      })
      listBox.append(item)
    }
  }

  rebuildList()

  const menuBtn = new Gtk.MenuButton({
    cssClasses: ["device-dropdown-btn"],
    child: headerBox,
    popover: popover,
  })

  current.connect("notify::description", () => {
    nameLabel.label = current.description ?? "Unknown"
  })

  return menuBtn
}

function AudioChannel({
  endpoint,
  label,
  endpoints,
}: {
  endpoint: Wp.Endpoint
  label: string
  endpoints: Wp.Endpoint[]
}) {
  const mute = createBinding(endpoint, "mute")
  const muteLabel = mute.as((m) => m ? "󰖁" : "󰕾")
  const muteClass = mute.as((m) => m ? "icon-button mute-btn active" : "icon-button mute-btn")

  const dropdown = endpoints.length > 1
    ? DeviceDropdown({ endpoints, current: endpoint })
    : null

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4} class="audio-channel">
      <box spacing={8}>
        {dropdown
          ? dropdown
          : <label label={createBinding(endpoint, "description").as((d: string) => d ?? "Unknown")} class="audio-device-name" hexpand halign={Gtk.Align.START} />
        }
      </box>
      <box spacing={8}>
        <button class={muteClass} onClicked={() => { endpoint.mute = !endpoint.mute }}>
          <label label={muteLabel} />
        </button>
        <VolumeSlider endpoint={endpoint} />
      </box>
    </box>
  ) as Gtk.Box
}

export default function Audio() {
  const wp = Wp.get_default()!
  const audio = wp.audio

  const speakerAccessor = createBinding(wp, "default_speaker" as any)
  const micAccessor = createBinding(wp, "default_microphone" as any)
  const speakersAccessor = createBinding(audio, "speakers")
  const microphonesAccessor = createBinding(audio, "microphones")

  const speakerBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
  const micBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  createEffect(() => {
    clearBox(speakerBox)
    const s = speakerAccessor() as Wp.Endpoint | null
    const list = speakersAccessor() as Wp.Endpoint[] | null
    if (s) {
      speakerBox.append(AudioChannel({
        endpoint: s,
        label: "Output",
        endpoints: list ?? [],
      }))
    } else {
      speakerBox.append(new Gtk.Label({ label: "No speaker" }))
    }
  })

  createEffect(() => {
    clearBox(micBox)
    const m = micAccessor() as Wp.Endpoint | null
    const list = microphonesAccessor() as Wp.Endpoint[] | null
    if (m) {
      micBox.append(AudioChannel({
        endpoint: m,
        label: "Input",
        endpoints: list ?? [],
      }))
    } else {
      micBox.append(new Gtk.Label({ label: "No microphone" }))
    }
  })

  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={8} class="audio-section">
      {speakerBox}
      <box class="audio-separator" />
      {micBox}
    </box>
  )
}
