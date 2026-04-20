import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { toastSuccess, toastError, toastInfo, toastWarning, toastLoading, toastDismiss } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
  toastLoading: vi.fn(),
  toastDismiss: vi.fn(),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: ReactNode }) => open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children: ReactNode }) => open ? <div data-testid="alert-dialog-root">{children}</div> : null,
  AlertDialogAction: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  AlertDialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  AlertDialogFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AlertDialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
}))

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    info: toastInfo,
    warning: toastWarning,
    loading: toastLoading,
    dismiss: toastDismiss,
  },
}))

import { ImportResumeModal } from "./resume-builder"

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

  afterEach(() => {
    vi.useRealTimers()
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
        pdfImportPollMs={10}
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
    expect(toastSuccess).toHaveBeenCalledWith(
      "Currículo importado com sucesso.",
      expect.objectContaining({ id: "resume-import-pdf" }),
    )
  })

  it("shows an import error when the upload route fails", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Não conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionável ou preencha manualmente.",
      }),
    })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={vi.fn()}
        pdfImportPollMs={10}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Não conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionável ou preencha manualmente.",
        expect.objectContaining({ id: "resume-import-pdf" }),
      )
    })
  })

  it("polls queued PDF imports until the async job completes", async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const onImportSuccess = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        status: 202,
        json: async () => ({
          success: true,
          jobId: "job_pdf_123",
          status: "pending",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job_pdf_123",
          status: "processing",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job_pdf_123",
          status: "completed",
          warningMessage: "Revise os dados importados antes de salvar. A confianca desta leitura foi baixa.",
        }),
      })
      .mockResolvedValueOnce({
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
        pdfImportPollMs={10}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(onImportSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: "Ana Silva" }),
        null,
        "pdf",
      )
    }, { timeout: 8000 })

    expect(toastWarning).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith(
      "Currículo importado com sucesso. Revise os dados importados antes de salvar. A confianca desta leitura foi baixa.",
      expect.objectContaining({ id: "resume-import-pdf" }),
    )
  })

  it("shows a failed async PDF import status when the background job fails", async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        status: 202,
        json: async () => ({
          success: true,
          jobId: "job_pdf_123",
          status: "pending",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job_pdf_123",
          status: "failed",
          errorMessage:
            "Não conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionável ou preencha manualmente.",
        }),
      })

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)

    render(
      <ImportResumeModal
        isOpen
        onClose={vi.fn()}
        onImportSuccess={vi.fn()}
        pdfImportPollMs={10}
      />,
    )

    const input = screen.getByLabelText(/clique para selecionar um pdf/i)
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" })

    await user.upload(input, file)
    await user.click(screen.getAllByRole("button", { name: /importar arquivo/i })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Não conseguimos extrair texto desse PDF. Se ele for escaneado, tente outro PDF com texto selecionável ou preencha manualmente.",
        expect.objectContaining({ id: "resume-import-pdf" }),
      )
    }, { timeout: 5000 })
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
        error: "Esse arquivo não trouxe novas informações para o seu perfil atual.",
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
      expect(toastError).toHaveBeenCalledWith(
        "Esse arquivo não trouxe novas informações para o seu perfil atual.",
        expect.objectContaining({ id: "resume-import-pdf" }),
      )
    })

    expect(screen.getByText("resume.pdf")).toBeInTheDocument()
    expect(screen.getByText(/importa.+o falhou/i)).toBeInTheDocument()

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

    expect(screen.getByLabelText(/clique para selecionar um pdf/i)).toBeInTheDocument()
    expect(screen.queryByText(/Status da importação:/i)).not.toBeInTheDocument()
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

    expect(screen.getAllByRole("button", { name: /importando curr.+culo/i })[0]).toBeDisabled()
    expect(screen.getByText("resume-2.pdf")).toBeInTheDocument()
    expect(screen.getByText(/extraindo e organizando dados/i)).toBeInTheDocument()

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
    expect(screen.getAllByRole("button", { name: /importando curr.+culo/i })[0]).toBeDisabled()
    expect(screen.getByText("resume-2.pdf")).toBeInTheDocument()
    expect(screen.getByText(/extraindo e organizando dados/i)).toBeInTheDocument()

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
