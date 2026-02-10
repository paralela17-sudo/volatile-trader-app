/**
 * Simple Health Check API
 * Helps verify if Vercel Serverless Functions are operational independently of the frontend.
 */
export default function handler(req, res) {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        message: 'Binance Proxy Service is alive'
    });
}
