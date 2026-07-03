export function Logo({ className = "w-8 h-8", variant = "icon" }: { className?: string, variant?: "icon" | "horizontal" }) {
  if (variant === "horizontal") {
    return (
      <img
        src="/hellnah-terminal.png"
        alt="Hellnah Terminal Logo"
        className={className}
      />
    )
  }

  return (
    <img
      src="/hellnah-terminal.png"
      alt="Hellnah Terminal Icon"
      className={className}
    />
  )
}