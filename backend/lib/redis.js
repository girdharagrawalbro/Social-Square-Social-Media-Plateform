const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isDisabled = process.env.DISABLE_REDIS === 'true';

// ─── REDIS COMMAND LOGGER ────────────────────────────────────────────────────
// Enable with env var: REDIS_LOG_COMMANDS=true
// Prints a per-command breakdown every 60 seconds so you can see exactly what
// is generating traffic without touching Upstash's billing counter.
const LOGGING_ENABLED = process.env.REDIS_LOG_COMMANDS === 'true';

const _commandLog = { _window: Date.now(), _total: 0 };

function _recordCommand(cmd) {
    if (!LOGGING_ENABLED) return;
    const key = (cmd || 'UNKNOWN').toUpperCase();
    _commandLog[key] = (_commandLog[key] || 0) + 1;
    _commandLog._total++;
}

function _flushLog() {
    if (!LOGGING_ENABLED) return;
    const elapsed = Math.round((Date.now() - _commandLog._window) / 1000);
    const total = _commandLog._total;

    if (total === 0) {
        console.log(`[Redis Logger] 0 commands in last ${elapsed}s`);
    } else {
        const lines = Object.entries(_commandLog)
            .filter(([k]) => !k.startsWith('_'))
            .sort(([, a], [, b]) => b - a)
            .map(([k, v]) => `    ${k.padEnd(14)} ${v.toString().padStart(5)} (${((v / total) * 100).toFixed(1)}%)`)
            .join('\n');
        console.log(
            `\n┌─ [Redis Logger] ${total} commands in last ${elapsed}s ──────────────\n` +
            lines +
            `\n└────────────────────────────────────────────────────────────────────\n`
        );
    }

    // Reset window
    Object.keys(_commandLog)
        .filter(k => !k.startsWith('_'))
        .forEach(k => delete _commandLog[k]);
    _commandLog._window = Date.now();
    _commandLog._total = 0;
}

if (LOGGING_ENABLED) {
    setInterval(_flushLog, 60_000);
    console.log('[Redis Logger] Command logging ACTIVE — flushing every 60s. To stop: remove REDIS_LOG_COMMANDS from .env');
}
// ─────────────────────────────────────────────────────────────────────────────

let redis;

if (isDisabled) {
    console.log('[Redis] Disabled via DISABLE_REDIS flag');
    // Minimal mock to enable socket functionality (online status, typing) in single-instance mode
    const inMemoryData = {};
    redis = {
        hset: async (key, field, value) => {
            if (!inMemoryData[key]) inMemoryData[key] = {};
            inMemoryData[key][field] = value;
        },
        hget: async (key, field) => {
            return inMemoryData[key]?.[field] || null;
        },
        hdel: async (key, field) => {
            if (inMemoryData[key]) delete inMemoryData[key][field];
        },
        hgetall: async (key) => {
            return inMemoryData[key] || {};
        },
        get: async (key) => inMemoryData[key] || null,
        set: async (key, value) => { inMemoryData[key] = value; },
        del: async (...keys) => {
            const flatKeys = Array.isArray(keys[0]) ? keys[0] : keys;
            flatKeys.forEach(k => {
                if (k.endsWith('*')) {
                    const prefix = k.slice(0, -1);
                    Object.keys(inMemoryData).forEach(key => {
                        if (key.startsWith(prefix)) delete inMemoryData[key];
                    });
                } else {
                    delete inMemoryData[k];
                }
            });
        },
        on: () => { },
        quit: async () => { },
        status: 'disabled',
        duplicate: function () { return this; },
        connect: async () => { },
    };
} else {
    redis = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
            const MAX_ATTEMPTS = 5;
            if (times > MAX_ATTEMPTS) {
                console.error('[Redis] Max retry attempts reached. Connection failed.');
                return null;
            }
            return Math.min(times * 50, 2000);
        },
    });

    // Intercept all outgoing commands for logging
    if (LOGGING_ENABLED) {
        const _origSend = redis.sendCommand.bind(redis);
        redis.sendCommand = function (command) {
            _recordCommand(command.name);
            return _origSend(command);
        };
    }

    redis.on('error', (err) => {
        if (err.message.includes('Limit reached') || err.message.includes('quota')) {
            console.error('[Redis] CRITICAL: Upstash limit reached! Please set DISABLE_REDIS=true in your environment.');
        } else {
            console.error('[Redis] Error:', err.message);
        }
    });

    console.log(`[Redis] Initialized with URL: ${redisUrl.split('@')[1] || '(local)'} (PID: ${process.pid})`);
}

redis.getRedis = () => redis;
redis.redis = redis;

// Export flush so you can trigger a report on-demand (e.g. in a test script)
redis.flushCommandLog = _flushLog;
redis.commandLog = _commandLog;

module.exports = redis;