import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createSupabaseAdminClient } from '../lib/supabaseAdmin.js';
import { requireAdminToken } from './auth.js';
import { handlePricesRequest } from '../lib/pricesApiCore.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * Важно: в проде этот файл запускается из `server-dist/server/index.js`.
 * Если брать `.env` относительно `__dirname`, получится `server-dist/.env`,
 * а не `MEXC/.env`. Поэтому используем `process.cwd()` (ожидается запуск из `MEXC/`).
 */
const ROOT = process.cwd();
dotenv.config({ path: path.resolve(ROOT, '.env.local') });
dotenv.config({ path: path.resolve(ROOT, '.env') });
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ ok: true }));
// Public API: prices proxy (no CORS issues in browser)
app.get('/api/prices', async (req, res) => {
    try {
        const forwardedProto = String(req.header('x-forwarded-proto') ?? '');
        const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
        const forwardedHost = String(req.header('x-forwarded-host') ?? '');
        const host = (forwardedHost ? forwardedHost.split(',')[0].trim() : req.header('host')) || 'localhost';
        const fullUrl = new URL(req.originalUrl || req.url, `${proto}://${host}`);
        const apiRes = await handlePricesRequest(fullUrl);
        res.status(apiRes.status);
        apiRes.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'transfer-encoding')
                res.setHeader(key, value);
        });
        const buf = Buffer.from(await apiRes.arrayBuffer());
        res.send(buf);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
/**
 * Example admin endpoint: write a system log entry (bypasses RLS).
 *
 * Request:
 *  POST /api/admin/system-logs
 *  Headers: x-admin-token: <ADMIN_API_TOKEN>
 *  Body: { "message": "...", "meta": { ... } }
 */
app.post('/api/admin/system-logs', requireAdminToken, async (req, res) => {
    try {
        const supabase = createSupabaseAdminClient();
        const message = String(req.body?.message ?? '').trim();
        const meta = req.body?.meta ?? null;
        if (!message)
            return res.status(400).json({ error: 'message is required' });
        const { data, error } = await supabase
            .from('system_logs')
            .insert({ message, meta })
            .select()
            .single();
        if (error)
            return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
    }
    catch (e) {
        return res.status(500).json({ error: String(e) });
    }
});
// Serve built SPA (useful behind reverse proxy / on Render)
const distDir = path.resolve(ROOT, 'dist');
app.use(express.static(distDir));
// Express v5 + path-to-regexp v6: use regex for catch-all.
app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
});
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Admin API listening on http://localhost:${port}`);
});
