export const embeddedClerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "border-0 bg-transparent shadow-none rounded-none p-0",
    input:
      "h-12 w-full border-0 bg-transparent px-4 py-3 text-sm text-foreground shadow-none outline-none ring-0",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "w-full h-12 rounded-xl border-0 bg-foreground text-background hover:bg-foreground/90",
    socialButtonsBlockButtonText: "font-semibold",
    dividerLine: "bg-border",
    dividerText: "text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground",
    formButtonPrimary:
      "h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-none",
    formFieldInput:
      "h-full w-full border-0 bg-transparent px-4 py-3 text-sm text-foreground shadow-none focus:ring-0 focus:outline-none",
    formFieldInputGroup:
      "min-h-12 overflow-hidden rounded-xl border border-border bg-background shadow-none transition-colors focus-within:border-foreground/20",
    formInputGroup:
      "min-h-12 overflow-hidden rounded-xl border border-border bg-background shadow-none transition-colors focus-within:border-foreground/20",
    formFieldLabel: "text-sm font-medium text-foreground",
    footerActionLink: "text-foreground/70 underline-offset-4 hover:text-foreground hover:underline",
    alert: "rounded-2xl border border-amber-200 bg-amber-50 text-amber-900",
    formResendCodeLink: "text-foreground/70 underline-offset-4 hover:text-foreground hover:underline",
    identityPreviewText: "text-sm text-muted-foreground",
    footer: "hidden",
    formFieldRow: "gap-4",
    formFieldAction: "text-foreground/70 underline-offset-4 hover:text-foreground hover:underline",
    formFieldInputShowPasswordButton: "text-muted-foreground hover:text-foreground",
    formResendCodeLinkButton: "text-sm font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline",
    otpCodeFieldInput: "h-12 rounded-xl border border-border bg-background text-foreground",
  },
} as const
