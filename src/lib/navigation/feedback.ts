export const NAVIGATION_FEEDBACK_EVENT = "curria:navigation-start"

export function startNavigationFeedback(): void {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(NAVIGATION_FEEDBACK_EVENT))
}
