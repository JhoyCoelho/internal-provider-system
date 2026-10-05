declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        nome: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}

export {};
