export type AuthProvider = 'clerk'

export type SignupMethod = 'email' | 'google' | 'linkedin' | 'unknown'

export type UserStatus = 'active' | 'disabled'

export type UserAuthIdentity = {
  id: string
  userId: string
  provider: AuthProvider
  providerSubject: string
  signupMethod?: SignupMethod
  email?: string
  emailVerifiedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type CreditAccount = {
  id: string
  userId: string
  creditsRemaining: number
  createdAt: Date
  updatedAt: Date
}

export type AppUser = {
  id: string
  status: UserStatus
  displayName?: string
  primaryEmail?: string
  createdAt: Date
  updatedAt: Date
  authIdentity: UserAuthIdentity
  creditAccount: CreditAccount
}
