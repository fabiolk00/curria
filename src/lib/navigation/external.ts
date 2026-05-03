import { startNavigationFeedback } from "@/lib/navigation/feedback"

export function navigateToUrl(url: string): void {
  startNavigationFeedback()
  window.location.assign(url)
}
