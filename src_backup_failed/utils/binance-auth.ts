import * as crypto from 'crypto';

const isBrowser = typeof window !== 'undefined';

export function generateBinanceSignature(queryString: string, apiSecret: string): string {
    if (isBrowser) {
        console.warn('Signature generation skipped in browser. Real trades should be handled by backend.');
        return 'browser-mock-signature';
    }

    try {
        return crypto
            .createHmac('sha256', apiSecret)
            .update(queryString)
            .digest('hex');
    } catch (e) {
        console.error('Error generating signature:', e);
        return 'error-signature';
    }
}
