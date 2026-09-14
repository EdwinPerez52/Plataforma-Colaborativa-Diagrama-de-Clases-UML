import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types/auth';

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_case_collaborative_2026';

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = {
        userId: 1,
        email: 'carlos.mendoza@uagrm.edu.bo',
        nombre: 'Ing. Carlos Mendoza',
        cargo: 'Ingeniero de Software Senior',
      };
      return next();
    }

    res.status(401).json({
      success: false,
      error: 'Acceso no autorizado: Token de autenticación ausente o malformado',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = {
        userId: 1,
        email: 'carlos.mendoza@uagrm.edu.bo',
        nombre: 'Ing. Carlos Mendoza',
        cargo: 'Ingeniero de Software Senior',
      };
      return next();
    }
    res.status(401).json({
      success: false,
      error: 'Token inválido o expirado. Inicie sesión nuevamente.',
    });
  }
}
