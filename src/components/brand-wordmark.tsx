import { cn } from "@/lib/utils"

type BrandWordmarkProps = {
  className?: string
  accentClassName?: string
}

export default function BrandWordmark({ className, accentClassName }: BrandWordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap",
        className,
      )}
      aria-label="Trampofy"
    >
      <span
        aria-hidden="true"
        className={cn(
          "block h-[1.35em] w-[5.4em] max-w-full bg-contain bg-left bg-no-repeat",
          accentClassName,
        )}
        style={{ backgroundImage: "url('/trampofy-logo.svg')" }}
      />
    </span>
  )
}
