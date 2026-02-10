const isBrowser = typeof window !== 'undefined';

export function generateBinanceSignature(queryString: string, apiSecret: string): string {
    if (isBrowser) {
        console.warn('Signature generation skipped in browser. Real trades should be handled by backend.');
        return 'browser-mock-signature';
    }

    const crypto = require('crypto');
    return crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');
}
