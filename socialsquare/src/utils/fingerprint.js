let cachedFingerprint = null;
let fingerprintPromise = null;

export async function getFingerprint() {
    if (cachedFingerprint) return cachedFingerprint;
    if (fingerprintPromise) return fingerprintPromise;

    fingerprintPromise = (async () => {
        try {
            // 1. Try to get from localStorage
            let storedUuid = null;
            try {
                storedUuid = localStorage.getItem('device_fingerprint_uuid');
            } catch (e) {
                console.warn('[FINGERPRINT] localStorage access denied:', e.message);
            }

            // 2. Generate deterministic traits
            const traits = [
                navigator.userAgent,
                navigator.language,
                new Date().getTimezoneOffset(),
                navigator.hardwareConcurrency || 'unknown',
                navigator.platform || 'unknown',
                window.screen.width + 'x' + window.screen.height,
                window.screen.colorDepth,
            ];

            // 3. If we have a stored UUID, use it to make it even more unique
            if (storedUuid) {
                traits.push(storedUuid);
            } else {
                // If no stored UUID, try to create and save one for next time
                const newUuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
                try {
                    localStorage.setItem('device_fingerprint_uuid', newUuid);
                    traits.push(newUuid);
                } catch (e) {
                    // If we can't save it, we just don't use a UUID.
                    // This makes the fingerprint deterministic based on traits only.
                    console.warn('[FINGERPRINT] Could not persist UUID, using deterministic traits only.');
                }
            }

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

