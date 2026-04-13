export const embeddedClerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "border-0 bg-transparent shadow-none rounded-none p-0",
    input:
      "appearance-none [-webkit-appearance:none] [-moz-appearance:none] border-0 bg-transparent px-4 shadow-none outline-none ring-0",
    formFieldInput:
      "appearance-none [-webkit-appearance:none] [-moz-appearance:none] border-0 bg-transparent px-4 shadow-none outline-none ring-0",
    formFieldInputGroup:
      "rounded-xl border border-input bg-background shadow-none overflow-hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "w-full h-12 rounded-xl border-0 bg-foreground text-background hover:bg-foreground/90",
    socialButtonsBlockButtonText: "font-semibold",
    dividerLine: "bg-border",
    dividerText: "text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground",
    formButtonPrimary:
      "h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-none",
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
    otpCodeFieldInput: "text-foreground",
  },
} as const
