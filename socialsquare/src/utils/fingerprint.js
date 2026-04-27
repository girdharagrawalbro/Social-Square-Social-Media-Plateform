let cachedFingerprint = null;
let fingerprintPromise = null;

export async function getFingerprint() {
    if (cachedFingerprint) return cachedFingerprint;
    if (fingerprintPromise) return fingerprintPromise;

    fingerprintPromise = (async () => {
        try {
            // 1. Generate deterministic traits
            const traits = [
                navigator.userAgent,
                navigator.language,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 'unknown',
                navigator.platform || 'unknown',
                window.screen.width + 'x' + window.screen.height,
                window.screen.colorDepth,
            ];

            const raw = traits.join('|');
            let finalFp = '';

            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(raw);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                finalFp = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (err) {
                // Simple hash fallback
                let hash = 0;
                for (let i = 0; i < raw.length; i++) {
                    hash = (hash << 5) - hash + raw.charCodeAt(i);
                    hash |= 0;
                }
                finalFp = 'dt-' + Math.abs(hash).toString(16);
            }

            cachedFingerprint = finalFp;
            return finalFp;
        } finally {
            fingerprintPromise = null;
        }
    })();

    return fingerprintPromise;
}

