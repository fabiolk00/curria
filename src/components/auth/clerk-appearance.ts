export const embeddedClerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "border border-border/50 bg-card shadow-xl rounded-xl",
    headerTitle: "text-2xl font-bold tracking-tight",
    headerSubtitle: "text-sm text-muted-foreground",
    socialButtonsBlockButton:
      "h-11 border-border/60 bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
    socialButtonsBlockButtonText: "font-medium",
    dividerLine: "bg-border/60",
    dividerText: "text-xs font-medium uppercase text-muted-foreground",
    formButtonPrimary:
      "h-11 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none",
    formFieldInput:
      "h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-none",
    formFieldLabel: "text-sm font-medium text-foreground",
    footerActionLink: "text-primary hover:text-primary/90",
    alert: "border-destructive/30 bg-destructive/5 text-destructive",
    formResendCodeLink: "text-primary hover:text-primary/90",
    identityPreviewText: "text-sm text-muted-foreground",
  },
} as const
