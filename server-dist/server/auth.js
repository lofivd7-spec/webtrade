function getRequiredEnv(name) {
    const v = process.env[name];
    if (!v || !v.trim())
        throw new Error(`Missing required env var: ${name}`);
    return v.trim();
}
export function requireAdminToken(req, res, next) {
    const expected = getRequiredEnv('ADMIN_API_TOKEN');
    const got = String(req.header('x-admin-token') ?? '');
    if (!got || got !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
}
