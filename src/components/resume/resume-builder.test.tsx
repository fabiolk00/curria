import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ImportResumeModal } from "./resume-builder"

const { toastSuccess, toastError, toastInfo, toastWarning } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
    warning: toastWarning,
  },
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe("ImportResumeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uploads a PDF and forwards the imported profile data", async () => {
    const user = userEvent.setup()
    const onImportSuccess = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          cvState: {
            fullName: "Ana Silva",
            email: "ana@example.com",
            phone: "",
            summary: "Backend engineer",
            experience: [],
            skills: [],
            education: [],
          },
          profilePhotoUrl: null,
          source: "pdf",
        },
      }),
    })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={onImportSuccess}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/profile/upload", expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: expect.any(FormData),
      }))
    })

    expect(onImportSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Ana Silva" }),
      null,
      "pdf",
    )
    expect(toastSuccess).toHaveBeenCalledWith("Curriculo importado com sucesso.")
  })

  it("shows an import error when the upload route fails", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Nao conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionavel ou preencha manualmente.",
      }),
    })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={vi.fn()}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Nao conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionavel ou preencha manualmente.",
      )
    })
  })

  it("asks for confirmation before replacing a LinkedIn-imported profile with PDF data", async () => {
    const user = userEvent.setup()
    const onImportSuccess = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          cvState: {
            fullName: "Bruna Costa",
            email: "",
            phone: "",
            summary: "Product designer",
            experience: [],
            skills: [],
            education: [],
          },
          profilePhotoUrl: null,
          source: "pdf",
        },
      }),
    })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={onImportSuccess}
        currentProfileSource="linkedin"
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    expect(
      screen.getByRole("heading", { name: /substituir perfil importado do linkedin/i }),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /substituir pelo pdf/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const [, requestInit] = fetchMock.mock.calls[0]
    const formData = requestInit.body as FormData
    expect(formData.get("replaceLinkedinImport")).toBe("true")
    expect(onImportSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Bruna Costa" }),
      null,
      "pdf",
    )
  })

  it("resets file import state when the modal closes and reopens", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Esse arquivo nao trouxe novas informacoes para o seu perfil atual.",
      }),
    })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    const onClose = vi.fn()
    const { rerender } = render(
      <ImportResumeModal
        isOpen
        onClose={onClose}
        onImportSuccess={vi.fn()}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Esse arquivo nao trouxe novas informacoes para o seu perfil atual.")
    })

    expect(screen.getByText("resume.pdf")).toBeInTheDocument()
    expect(screen.getByText(/status da importacao: importacao falhou/i)).toBeInTheDocument()

    rerender(
      <ImportResumeModal
        isOpen={false}
        onClose={onClose}
        onImportSuccess={vi.fn()}
      />,
    )

    rerender(
      <ImportResumeModal
        isOpen
        onClose={onClose}
        onImportSuccess={vi.fn()}
      />,
    )

    expect(screen.getByText("Clique para selecionar um PDF.")).toBeInTheDocument()
    expect(screen.queryByText(/status da importacao:/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /importar arquivo/i })[0]).toBeDisabled()
  })

  it("keeps upload B busy when upload A resolves after the modal was closed and reopened", async () => {
    const user = userEvent.setup()
    const uploadRequestA = createDeferred<{
      ok: boolean
      json: () => Promise<{
        profile: {
          cvState: {
            fullName: string
            email: string
            phone: string
            summary: string
            experience: never[]
            skills: never[]
            education: never[]
          }
          profilePhotoUrl: null
          source: string
        }
      }>
    }>()
    const uploadRequestB = createDeferred<{
      ok: boolean
      json: () => Promise<{
        profile: {
          cvState: {
            fullName: string
            email: string
            phone: string
            summary: string
            experience: never[]
            skills: never[]
            education: never[]
          }
          profilePhotoUrl: null
          source: string
        }
      }>
    }>()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => uploadRequestA.promise)
      .mockImplementationOnce(() => uploadRequestB.promise)
    const onImportSuccess = vi.fn()

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    const { rerender } = render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={onImportSuccess}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    rerender(
      <ImportResumeModal
        isOpen={false}
        onClose={vi.fn()}
        onImportSuccess={onImportSuccess}
      />,
    )

    rerender(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={onImportSuccess}
      />,
    )

    const reopenedInput = screen.getByLabelText(/clique para selecionar um pdf/i)
    const secondFile = new File(["pdf second"], "resume-2.pdf", { type: "application/pdf" })

    await user.upload(reopenedInput, secondFile)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(screen.getAllByRole("button", { name: /importando curriculo/i })[0]).toBeDisabled()
    expect(screen.getByText("resume-2.pdf")).toBeInTheDocument()
    expect(screen.getByText(/status da importacao: extraindo e organizando dados/i)).toBeInTheDocument()

    uploadRequestA.resolve({
      ok: true,
      json: async () => ({
        profile: {
          cvState: {
            fullName: "Ana Silva",
            email: "ana@example.com",
            phone: "",
            summary: "Backend engineer",
            experience: [],
            skills: [],
            education: [],
          },
          profilePhotoUrl: null,
          source: "pdf",
        },
      }),
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    expect(onImportSuccess).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.getAllByRole("button", { name: /importando curriculo/i })[0]).toBeDisabled()
    expect(screen.getByText("resume-2.pdf")).toBeInTheDocument()
    expect(screen.getByText(/status da importacao: extraindo e organizando dados/i)).toBeInTheDocument()

    uploadRequestB.resolve({
      ok: true,
      json: async () => ({
        profile: {
          cvState: {
            fullName: "Bruna Costa",
            email: "bruna@example.com",
            phone: "",
            summary: "Product designer",
            experience: [],
            skills: [],
            education: [],
          },
          profilePhotoUrl: null,
          source: "pdf",
        },
      }),
    })

    await waitFor(() => {
      expect(onImportSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: "Bruna Costa" }),
        null,
        "pdf",
      )
    })
  })

  it("prevents duplicate file uploads from rapid repeated clicks", async () => {
    const user = userEvent.setup()
    const uploadRequest = createDeferred<{
      ok: boolean
      json: () => Promise<{
        profile: {
          cvState: {
            fullName: string
            email: string
            phone: string
            summary: string
            experience: never[]
            skills: never[]
            education: never[]
          }
          profilePhotoUrl: null
          source: string
        }
      }>
    }>()
    const fetchMock = vi.fn().mockImplementation(() => uploadRequest.promise)

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={vi.fn()}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)

    const importButton = screen.getAllByRole("button", { name: /importar arquivo/i })[0]

    fireEvent.click(importButton)
    fireEvent.click(importButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
