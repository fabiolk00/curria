import { Badge } from "@/components/ui/badge"

export default function ATSScoreBadge({
  score,
  showLabel = true,
}: {
  score: number
  showLabel?: boolean
}) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500"
  return <Badge className={color}>{showLabel ? `ATS: ${score}` : score}</Badge>
}
