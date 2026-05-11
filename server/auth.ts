import type { Request, Response, NextFunction } from 'express';

function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const expected = getRequiredEnv('ADMIN_API_TOKEN');
  const got = String(req.header('x-admin-token') ?? '');

  if (!got || got !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

