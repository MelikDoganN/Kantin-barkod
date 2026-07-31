import type { Response } from 'express'

export interface SuccessResponse<T> {
  success: true
  data: T
  message: string
}

export interface ErrorResponse {
  success: false
  message: string
  code?: string
}

export function success<T>(res: Response, data: T, message = '', status = 200): Response {
  const body: SuccessResponse<T> = { success: true, data, message }
  return res.status(status).json(body)
}

export function failure(
  res: Response,
  message: string,
  status = 400,
  code?: string,
): Response {
  const body: ErrorResponse = code
    ? { success: false, message, code }
    : { success: false, message }
  return res.status(status).json(body)
}
