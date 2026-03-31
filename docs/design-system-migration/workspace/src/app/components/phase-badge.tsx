import { Badge } from "./ui/badge"

export default function PhaseBadge({ phase }: { phase: string }) {
  return (
    <Badge variant="outline">
      {phase}
    </Badge>
  )
}
