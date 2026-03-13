interface IconButtonProps {
  icon: string
  tooltip?: string
  onClick: () => void
  className?: string
}

export default function IconButton({ icon, tooltip, onClick, className }: IconButtonProps) {
  return (
    <button
      onClicked={onClick}
      tooltipText={tooltip}
      class={`icon-button ${className ?? ""}`}
    >
      <label label={icon} />
    </button>
  )
}
