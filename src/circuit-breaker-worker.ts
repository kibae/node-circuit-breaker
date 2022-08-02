import { isMainThread, Worker, BroadcastChannel } from 'worker_threads';

enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

const channel = new BroadcastChannel('worker');

if (isMainThread) {
    let worker: Worker;
    let terminated = false;

    let metadataProvider: (id: string) => Object;
    let stateCallback: (id: string, state: CircuitBreakerState) => Promise<boolean>;

    function createWorker() {
        if (terminated) return;
        worker = new Worker(__filename, { resourceLimits: {} });
        worker.on('error', async (e) => {
            console.error(e);
            await worker.terminate();
        });
        worker.on('exit', (code) => {
            if (!terminated && code !== 0) console.error(`Worker stopped with exit code ${code}`);
            createWorker();
        });
    }
    createWorker();

    channel.onmessage = async ({ data: { mode, id, data } }: any) => {
        // console.log('parent got message', mode, id, data);
        switch (mode) {
            case 'metadata':
                channel.postMessage({ mode, id, data: metadataProvider(id) });
                break;
            case 'circuit-open': {
                if (!(await stateCallback(id, CircuitBreakerState.Open))) channel.postMessage({ mode: 'circuit-close', id });
                break;
            }
            case 'circuit-halfopen': {
                if (!(await stateCallback(id, CircuitBreakerState.HalfOpen))) channel.postMessage({ mode: 'circuit-open', id });
                break;
            }
            case 'circuit-close': {
                if (!(await stateCallback(id, CircuitBreakerState.Closed))) channel.postMessage({ mode: 'circuit-open', id });
                break;
            }
        }
    };

    channel.onmessageerror = (ev) => {
        console.error(ev);
    };

    module.exports = {
        setMetadataProvider: (provider: (id: string) => Object) => {
            metadataProvider = provider;
        },
        setStateCallback: (callback: (id: string, state: CircuitBreakerState) => Promise<boolean>) => {
            stateCallback = callback;
        },
        setState: (id: string, state: CircuitBreakerState) => {
            channel.postMessage({ mode: state === CircuitBreakerState.Open ? 'circuit-open' : 'circuit-close', id });
        },
        pushError: (id: string, errorType: string) => {
            // console.log(id, errorType);
            channel.postMessage({ mode: 'push-error', id, data: { errorType } });
        },
        terminate: async () => {
            terminated = true;
            await worker?.terminate();
            channel.close();
        },
    };
} else {
    const metadata: {
        [key: string]: {
            id: string;
            fallbackForSeconds: number;
            rules: Array<{
                exceptions: string[];
                times: number;
                inSeconds: number;
            }>;
        };
    } = {};
    const metadataRequested: { [key: string]: boolean } = {};
    const errorRecords: { [key: string]: Array<{ time: number; error: string }> } = {};
    const openStates: { [key: string]: { changed: number; state: CircuitBreakerState } } = {};
    const debounce: { [key: string]: NodeJS.Immediate } = {};

    function openProcess(id: string) {
        delete debounce[id];
        if (openStates[id]?.state === CircuitBreakerState.Open || !metadata[id]) {
            // console.log('already open');
            return;
        }

        const meta = metadata[id];
        errorRecords[id] = errorRecords[id] || [];

        const oldestTime = Date.now() - meta.rules.reduce((result, item) => Math.max(item.inSeconds), 0) * 1000;
        while (errorRecords[id].length > 0 && errorRecords[id][0].time < oldestTime) errorRecords[id].shift();

        const records = errorRecords[id] || [];
        if (
            meta.rules.some((rule) => {
                const time = Date.now() - Math.max(rule.inSeconds) * 1000;

                const filtered = records.filter((record) => rule.exceptions.includes(record.error) && record.time >= time);
                return rule.times <= filtered.length;
            })
        ) {
            openStates[id] = { state: CircuitBreakerState.Open, changed: Date.now() };
            channel.postMessage({ mode: 'circuit-open', id });
        }
    }

    setInterval(() => {
        if (Object.keys(openStates).length <= 0) return;
        // console.log(openStates);

        const now = Date.now();
        const ids = Object.keys(openStates);
        for (const id of ids) {
            if (openStates[id].state !== CircuitBreakerState.Open) continue;

            const meta = metadata[id];
            if (meta.fallbackForSeconds * 1000 + openStates[id].changed > now) {
                openStates[id].state = CircuitBreakerState.HalfOpen;
                channel.postMessage({ mode: 'circuit-halfopen', id });
            }
        }
    }, 1000);

    channel.onmessageerror = (ev) => {
        console.error(ev);
    };

    channel.onmessage = async ({ data: { mode, id, data } }: any) => {
        // console.log('child got message', mode, id, data);
        switch (mode) {
            case 'push-error':
                if (!errorRecords[id]) errorRecords[id] = [];

                errorRecords[id].push({ time: Date.now(), error: data.errorType });

                if (metadata[id]) {
                    if (debounce[id]) clearImmediate(debounce[id]);
                    debounce[id] = setImmediate(() => openProcess(id));
                } else {
                    if (!metadataRequested[id]) {
                        channel.postMessage({ mode: 'metadata', id });
                        metadataRequested[id] = true;
                    }
                    return;
                }
                break;
            case 'circuit-open':
                openStates[id] = { state: CircuitBreakerState.Open, changed: Date.now() };
                break;
            case 'circuit-close':
                delete openStates[id];
                errorRecords[id] = [];
                break;
            case 'metadata':
                metadata[id] = data;

                openProcess(id);
                break;
        }
    };
}
