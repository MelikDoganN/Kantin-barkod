import type { NextFunction, Request, Response } from 'express'
import { failure } from '../utils/apiResponse'

type Role = 'ADMIN' | 'PERSONNEL'

export function requireRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      failure(res, 'Yetkisiz erişim.', 401)
      return
    }

    if (!roles.includes(req.user.role as Role)) {
      failure(res, 'Bu işlem için yetkiniz yok.', 403)
      return
    }

    next()
  }
}
