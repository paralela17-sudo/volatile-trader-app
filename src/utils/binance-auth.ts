const isBrowser = typeof window !== 'undefined';

// Helper for Node-only imports that Vite should ignore
const nodeRequire = (mod: string) => {
    if (isBrowser) return null;
    try {
        return require(mod);
    } catch (e) {
        return null;
    }
};

export function generateBinanceSignature(queryString: string, apiSecret: string): string {
    if (isBrowser) {
        console.warn('Signature generation skipped in browser. Real trades should be handled by backend.');
        return 'browser-mock-signature';
    }

    const crypto = nodeRequire('crypto');
    if (!crypto) return 'no-crypto-available';

    return crypto
        .createHmac('sha256', apiSecret)
        .update(queryString)
        .digest('hex');
}
