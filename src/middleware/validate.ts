import { Request, Response, NextFunction } from 'express';

export const validateBody = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter(
      (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
    );
    if (missing.length > 0) {
      res.status(400).json({ success: false, message: `Missing fields: ${missing.join(', ')}` });
      return;
    }
    next();
  };
};
