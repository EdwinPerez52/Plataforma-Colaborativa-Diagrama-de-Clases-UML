import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { RegisterDto, LoginDto, User, AuthPayload } from '../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_case_collaborative_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export class AuthService {
  /**
   * Registra un nuevo ingeniero en el sistema (CU01)
   */
  static async register(dto: RegisterDto): Promise<{ user: User; token: string }> {
    const { nombre, email, password, cargo } = dto;

    // Validación básica de campos
    if (!nombre || !email || !password) {
      throw new Error('Nombre, email y contraseña son obligatorios');
    }

    // Verificar si el correo ya está registrado
    const existingRes = await db.query('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingRes.rowCount && existingRes.rowCount > 0) {
      const error: any = new Error('El correo electrónico ya se encuentra registrado');
      error.statusCode = 409;
      throw error;
    }

    // Hasheo seguro de contraseña con salt 10
    const passwordHash = await bcrypt.hash(password, 10);
    const userCargo = cargo || 'Ingeniero de Software Senior';

    // Inserción atómica en usuarios
    const insertRes = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo, estado)
       VALUES ($1, $2, $3, $4, 'ACTIVO')
       RETURNING id, nombre, email, cargo, estado, creado_en, actualizado_en`,
      [nombre.trim(), email.toLowerCase().trim(), passwordHash, userCargo]
    );

    const newUser: User = insertRes.rows[0];

    // Expedición de JWT
    const payload: AuthPayload = {
      userId: Number(newUser.id),
      email: newUser.email,
      nombre: newUser.nombre,
      cargo: newUser.cargo,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    return { user: newUser, token };
  }

  /**
   * Inicia sesión con credenciales y valida estado de cuenta (CU01)
   */
  static async login(dto: LoginDto): Promise<{ user: User; token: string }> {
    const { email, password } = dto;

    if (!email || !password) {
      throw new Error('Email y contraseña son obligatorios');
    }

    const userRes = await db.query(
      `SELECT id, nombre, email, password_hash, cargo, estado, creado_en, actualizado_en
       FROM usuarios
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rowCount === 0) {
      const error: any = new Error('Credenciales incorrectas: Correo o contraseña no válidos');
      error.statusCode = 401;
      throw error;
    }

    const dbUser = userRes.rows[0];

    // Verificar si la cuenta está activa
    if (dbUser.estado !== 'ACTIVO') {
      const error: any = new Error(`Acceso denegado: Su cuenta se encuentra ${dbUser.estado.toLowerCase()}`);
      error.statusCode = 403;
      throw error;
    }

    // Comparación criptográfica del password
    const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash);
    if (!isPasswordValid) {
      const error: any = new Error('Credenciales incorrectas: Correo o contraseña no válidos');
      error.statusCode = 401;
      throw error;
    }

    const user: User = {
      id: Number(dbUser.id),
      nombre: dbUser.nombre,
      email: dbUser.email,
      cargo: dbUser.cargo,
      estado: dbUser.estado,
      creado_en: dbUser.creado_en,
      actualizado_en: dbUser.actualizado_en,
    };

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      cargo: user.cargo,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    return { user, token };
  }

  /**
   * Obtiene el perfil de un usuario por su ID
   */
  static async getProfile(userId: number): Promise<User> {
    const res = await db.query(
      `SELECT id, nombre, email, cargo, estado, creado_en, actualizado_en
       FROM usuarios
       WHERE id = $1`,
      [userId]
    );

    if (res.rowCount === 0) {
      const error: any = new Error('Usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    return res.rows[0];
  }

  /**
   * Genera un token para el usuario demo (Carlos Mendoza)
   */
  static async getGuestToken(): Promise<{ user: User; token: string }> {
    const userRes = await db.query('SELECT id, nombre, email, cargo, estado FROM usuarios WHERE id = 1');
    const user: User = userRes.rows[0] || {
      id: 1,
      nombre: 'Ing. Carlos Mendoza',
      email: 'carlos.mendoza@uagrm.edu.bo',
      cargo: 'Ingeniero de Software Senior',
      estado: 'ACTIVO',
    };

    const payload: AuthPayload = {
      userId: Number(user.id),
      email: user.email,
      nombre: user.nombre,
      cargo: user.cargo,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    return { user, token };
  }
}
