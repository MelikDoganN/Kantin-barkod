import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthTokenPayload {
  id: number
  username: string
  role: string
}

const TOKEN_EXPIRES_IN: SignOptions['expiresIn'] = '8h'

export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_EXPIRES_IN })
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret)

  if (typeof decoded === 'string') {
    throw new Error('Geçersiz token')
  }

  return {
    id: Number((decoded as jwt.JwtPayload).id),
    username: String((decoded as jwt.JwtPayload).username),
    role: String((decoded as jwt.JwtPayload).role),
  }
}
