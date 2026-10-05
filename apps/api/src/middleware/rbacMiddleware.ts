import type { NextFunction, Request, Response } from 'express';

export type RequiredPermission =
  | string
  | {
      anyOf?: string[];
      allOf?: string[];
    };

export function requirePermissions(required: RequiredPermission | RequiredPermission[]) {
  const requiredList = Array.isArray(required) ? required : [required];

  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }

    const permissions = new Set(user.permissions ?? []);
    const roles = new Set(user.roles ?? []);

    const hasAccess = requiredList.every((rule) => {
      if (typeof rule === 'string') {
        return permissions.has(rule);
      }

      if (rule.anyOf && rule.anyOf.length > 0) {
        return rule.anyOf.some((permission) => permissions.has(permission) || roles.has(permission));
      }

      if (rule.allOf && rule.allOf.length > 0) {
        return rule.allOf.every((permission) => permissions.has(permission) || roles.has(permission));
      }

      return false;
    });

    if (!hasAccess) {
      return res.status(403).json({
        message: 'Você não possui permissão para acessar este recurso.',
      });
    }

    return next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }

    const hasRole = roles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        message: `Acesso negado. Perfis exigidos: ${roles.join(', ')}`,
      });
    }

    return next();
  };
}
