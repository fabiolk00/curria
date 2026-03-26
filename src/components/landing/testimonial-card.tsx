import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Quote, Star } from "lucide-react"

interface TestimonialCardProps {
  name: string
  role: string
  quote: string
  initials: string
  color?: string
}

export function TestimonialCard({ name, role, quote, initials, color = "bg-primary" }: TestimonialCardProps) {
  return (
    <Card className="min-w-[320px] max-w-[380px] bg-card border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <Quote className="h-8 w-8 text-primary/30 mb-4" />
        
        <p className="text-foreground/90 text-sm leading-relaxed mb-6">
          &ldquo;{quote}&rdquo;
        </p>
        
        <div className="flex items-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-warning text-warning" />
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={`${color} text-primary-foreground font-semibold text-sm`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground text-sm">{name}</p>
            <p className="text-muted-foreground text-xs">{role}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
