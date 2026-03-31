export async function getFingerprint() {
    let fp = localStorage.getItem('device_fingerprint');
    if (fp) return fp;

    const components = [
        navigator.userAgent,
        navigator.language,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.platform || 'unknown',
        crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    ];

    const raw = components.join('|');
    let finalFp = '';

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        finalFp = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash << 5) - hash + raw.charCodeAt(i);
            hash |= 0;
        }
        finalFp = Math.abs(hash).toString(16);
    }

    localStorage.setItem('device_fingerprint', finalFp);
    return finalFp;
}