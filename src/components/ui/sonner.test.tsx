import type { CSSProperties, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const sonnerMock = vi.fn(({
  closeButton,
  style,
  icons,
  toastOptions,
}: {
  closeButton?: boolean
  style?: CSSProperties
  icons?: {
    success?: ReactNode
    error?: ReactNode
    close?: ReactNode
  }
  toastOptions?: {
    classNames?: {
      closeButton?: string
    }
  }
}) => (
  <div
    data-testid="mock-sonner"
    data-close-button={String(closeButton)}
    data-bg={style?.["--normal-bg" as keyof CSSProperties] as string}
    data-text={style?.["--normal-text" as keyof CSSProperties] as string}
    data-border={style?.["--normal-border" as keyof CSSProperties] as string}
    data-has-success-icon={String(Boolean(icons?.success))}
    data-has-error-icon={String(Boolean(icons?.error))}
    data-has-close-icon={String(Boolean(icons?.close))}
    data-close-class={toastOptions?.classNames?.closeButton ?? ""}
  />
))

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => sonnerMock(props as never),
}))

import { Toaster } from "./sonner"

describe("Toaster", () => {
  it("uses a black info surface and enables manual close", () => {
    render(<Toaster />)

    const toaster = screen.getByTestId("mock-sonner")
    expect(toaster).toHaveAttribute("data-close-button", "true")
    expect(toaster).toHaveAttribute("data-bg", "#050505")
    expect(toaster).toHaveAttribute("data-text", "#ffffff")
    expect(toaster).toHaveAttribute("data-border", "#1f1f1f")
    expect(toaster).toHaveAttribute("data-has-success-icon", "true")
    expect(toaster).toHaveAttribute("data-has-error-icon", "true")
    expect(toaster).toHaveAttribute("data-has-close-icon", "true")
    expect(toaster.getAttribute("data-close-class")).toContain("!text-white")
  })
})
