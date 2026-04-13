import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { VisualResumeEditor, normalizeResumeData } from "./visual-resume-editor"

describe("VisualResumeEditor", () => {
  it("shows the primary manual setup fields on first render", () => {
    render(
      <VisualResumeEditor
        value={normalizeResumeData()}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByPlaceholderText("Nome completo")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText("Escreva um resumo curto sobre sua experiência, foco e resultados."),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Uma skill por linha/i)).toBeInTheDocument()
  })
})
