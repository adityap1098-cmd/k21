declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string
        role: string
        mustChangePassword: boolean
      }
    }
  }
}

export {}
