import { Gtk } from "ags/gtk4"

interface GridProps {
  columns: number
  rowSpacing?: number
  columnSpacing?: number
  class?: string
  children?: JSX.Element | JSX.Element[]
}

export default function Grid({
  columns,
  rowSpacing = 8,
  columnSpacing = 8,
  class: className,
  children,
}: GridProps) {
  const grid = new Gtk.Grid({
    rowSpacing,
    columnSpacing,
    cssClasses: className ? [className] : [],
    hexpand: true,
    columnHomogeneous: true,
  })

  const kids = Array.isArray(children) ? children.flat() : children ? [children] : []

  kids.forEach((child, i) => {
    if (child) {
      const row = Math.floor(i / columns)
      const col = i % columns
      grid.attach(child as Gtk.Widget, col, row, 1, 1)
    }
  })

  return grid
}
