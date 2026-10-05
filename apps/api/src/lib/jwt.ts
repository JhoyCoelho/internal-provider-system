import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  passwordVersion?: number;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '4h',
    issuer: 'sistema-interno-isp',
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
