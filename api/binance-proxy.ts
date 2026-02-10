import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Binance API Proxy - Serverless Function for Vercel
 * Bypasses regional geoblocks by routing requests through Vercel's US-based infrastructure.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { path, ...params } = req.query;

        if (!path) {
            return res.status(400).json({ error: 'Missing path parameter' });
        }

        // Build Binance URL
        const baseUrl = 'https://api.binance.com';
        const queryStr = Object.entries(params)
            .map(([key, val]) => `${key}=${val}`)
            .join('&');

        const targetUrl = `${baseUrl}${path}${queryStr ? '?' + queryStr : ''}`;

        console.log(`[Proxy] Forwarding to: ${targetUrl}`);

        const response = await fetch(targetUrl);
        const data = await response.json();

        return res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[Proxy Error]', error);
        return res.status(500).json({
            error: 'Proxy Error',
            message: error.message
        });
    }
}
