import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Sesión iniciada con éxito',
        data: result,
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'No autenticado' });
        return;
      }
      const user = await AuthService.getProfile(req.user.userId);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * GET /api/v1/auth/guest-token
   */
  static async getGuestToken(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.getGuestToken();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
}
