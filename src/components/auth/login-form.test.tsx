import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import LoginForm from './login-form'

// Mock Clerk hooks
const mockSignIn = vi.fn()
const mockPush = vi.fn()

vi.mock('@clerk/nextjs', () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: {
      create: mockSignIn,
    },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/components/logo', () => ({
  default: () => <div>Logo</div>,
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the login form', () => {
    render(<LoginForm />)

    expect(screen.getByText('Entrar na sua conta')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('has noValidate attribute on form', () => {
    const { container } = render(<LoginForm />)
    const form = container.querySelector('form')

    expect(form).toHaveAttribute('noValidate')
  })

  it('submits form when valid data is entered', async () => {
    mockSignIn.mockResolvedValue({ status: 'complete' })

    render(<LoginForm />)

    const emailInput = screen.getByLabelText('E-mail')
    const passwordInput = screen.getByLabelText('Senha')
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        password: 'password123',
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('shows error when email is invalid', async () => {
    render(<LoginForm />)

    const emailInput = screen.getByLabelText('E-mail')
    const passwordInput = screen.getByLabelText('Senha')
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    fireEvent.change(emailInput, { target: { value: 'invalid' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('E-mail inválido')).toBeInTheDocument()
    })
  })

  it('shows error when password is too short', async () => {
    render(<LoginForm />)

    const emailInput = screen.getByLabelText('E-mail')
    const passwordInput = screen.getByLabelText('Senha')
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'short' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Senha deve ter pelo menos 8 caracteres')).toBeInTheDocument()
    })
  })

  it('disables submit button while submitting', async () => {
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ status: 'complete' }), 100)))

    render(<LoginForm />)

    const emailInput = screen.getByLabelText('E-mail')
    const passwordInput = screen.getByLabelText('Senha')
    const submitButton = screen.getByRole('button', { name: /entrar/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
  })
})
