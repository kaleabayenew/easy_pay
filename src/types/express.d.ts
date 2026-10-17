import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { userId: number; phone: string; role: string };
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload & { userId: number; phone: string; role: string };
  }
}

export {};

