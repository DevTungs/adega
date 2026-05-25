import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  admin?: { id: string; username: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Token não informado' });
  }

  try {
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    req.admin = { id: decoded.id, username: decoded.username };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Token inválido ou expirado' });
  }
}
