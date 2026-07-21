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
            return 1;
        },
        hget: async (key, field) => {
            return inMemoryData[key]?.[field] || null;
        },
        hdel: async (key, field) => {
            if (inMemoryData[key]) delete inMemoryData[key][field];
            return 1;
        },
        hgetall: async (key) => {
            return inMemoryData[key] || {};
        },
        get: async (key) => {
            const val = inMemoryData[key];
            return val !== undefined ? val : null;
        },
        set: async (key, value, ...args) => {
            // Support EX/NX arguments by ignoring them but returning 'OK' to satisfy callers
            const isNX = args.includes('NX');
            if (isNX && inMemoryData[key] !== undefined) return null;

            inMemoryData[key] = value;
            return 'OK';
        },
        del: async (...keys) => {
            const flatKeys = Array.isArray(keys[0]) ? keys[0] : keys;
            let count = 0;
            flatKeys.forEach(k => {
                if (k.endsWith('*')) {
                    const prefix = k.slice(0, -1);
                    Object.keys(inMemoryData).forEach(key => {
                        if (key.startsWith(prefix)) {
                            delete inMemoryData[key];
                            count++;
                        }
                    });
                } else if (inMemoryData[k] !== undefined) {
                    delete inMemoryData[k];
                    count++;
                }
            });
            return count;
        },
        zadd: async (key, score, member) => {
            if (!inMemoryData[key]) inMemoryData[key] = {};
            inMemoryData[key][member] = Number(score);
            return 1;
        },
        zrem: async (key, member) => {
            if (inMemoryData[key] && inMemoryData[key][member] !== undefined) {
                delete inMemoryData[key][member];
                return 1;
            }
            return 0;
        },
        zrangebyscore: async (key, min, max) => {
            if (!inMemoryData[key]) return [];
            const results = [];
            const maxVal = max === '+inf' ? Infinity : Number(max);
            const minVal = min === '-inf' ? -Infinity : Number(min);
            for (const [member, score] of Object.entries(inMemoryData[key])) {
                if (score >= minVal && score <= maxVal) {
                    results.push(member);
                }
            }
            return results;
        },
        pipeline: function () {
            const operations = [];
            return {
                hdel: (k, f) => { operations.push(() => this.hdel(k, f)); return this; },
                zrem: (k, m) => { operations.push(() => this.zrem(k, m)); return this; },
                exec: async () => {
                    for (const op of operations) await op();
                    return [];
                }
            };
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
        enableReadyCheck: true,
        keepAlive: 10000,
        retryStrategy: (times) => {
            const delay = Math.min(times * 100, 3000);
            return delay;
        },
        reconnectOnError: (err) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
                return true;
            }
            return 1;
        }
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