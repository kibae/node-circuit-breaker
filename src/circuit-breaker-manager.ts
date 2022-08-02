import * as path from 'path';
import { CircuitBreakerOptions } from './decorators/circuit-breaker.decorator';
import { ExecutionTimeoutError } from './exceptions/execution-timeout-error';
import { AxiosExceptionPipe } from './exceptions/axios-extended-error';
import { TypeormExceptionPipe } from './exceptions/typeorm-extended-error';
import { CircuitBreakerScope, CircuitBreakerState } from './types/circuit.type';

let worker: any;
try {
    worker = require('./circuit-breaker-worker.js');
} catch (e) {
    worker = require('./circuit-breaker-worker.ts');
}

let seq: number = 0;
export class Circuit {
    id: string;
    caller: string;
    options: CircuitBreakerOptions;

    state: CircuitBreakerState = CircuitBreakerState.Closed;

    public static exceptionPipes: Array<(e: Error) => Error> = [AxiosExceptionPipe, TypeormExceptionPipe];

    constructor(caller: string, funcName: string, options: CircuitBreakerOptions) {
        this.id = (++seq).toString();
        this.caller = caller + ':' + funcName;
        this.options = options;
    }

    private _serializedOptions: any = null;
    public get serializedOptions(): string {
        if (!this._serializedOptions)
            this._serializedOptions = {
                fallbackForSeconds: this.options.fallbackForSeconds,
                rules: this.options.exceptions.map((item) => ({
                    types: item.types.map((errorType) => errorType.name),
                    times: item.times,
                    inSeconds: item.inSeconds,
                })),
            };
        return this._serializedOptions;
    }

    public async setState(state: CircuitBreakerState): Promise<boolean> {
        // console.log(this, state);
        if (state === CircuitBreakerState.Open && this.options.onCircuitOpen) {
            if (!(await this.options.onCircuitOpen(this))) return false;
        } else if (state === CircuitBreakerState.Closed && this.options.onCircuitClose) {
            if (!(await this.options.onCircuitClose(this))) return false;
        }
        this.state = state;
        return true;
    }

    public invoke(context: any, func: Function, trace: { stack?: string }, args: any[]) {
        if (this.state === CircuitBreakerState.Open) {
            if (typeof this.options.fallback === 'function') return this.options.fallback.apply(context, args);
            else if (
                typeof this.options.fallback === 'string' &&
                this.options.fallback in context &&
                typeof context[this.options.fallback] === 'function'
            ) {
                return context[this.options.fallback].apply(context, args);
            } else return this.options.fallback;
        }

        try {
            let result: any;
            if (this.options.timeoutMilliSeconds) {
                const begin = Date.now();
                result = func.apply(context, args);

                if (result instanceof Promise) {
                    return result.then((result) => {
                        this.pushTimeoutError(trace, Date.now() - begin, args);
                        return result;
                    });
                } else {
                    this.pushTimeoutError(trace, Date.now() - begin, args);
                    return result;
                }
            } else result = func.apply(context, args);

            if (this.state === CircuitBreakerState.HalfOpen) {
                this.setState(CircuitBreakerState.Closed).then((success) => {
                    if (success) worker.setState(this.id, CircuitBreakerState.Closed);
                });
            }
            return result;
        } catch (error) {
            // console.log('invoke error', error);
            this.pushError!(trace, error, args);

            throw error;
        }
    }

    private pushTimeoutError(trace: { stack?: string }, timeTaken: number, args: any[]) {
        if (this.options.timeoutMilliSeconds! < timeTaken) {
            const message = `CircuitBreaker: ${this.caller} execution timeout ${timeTaken} > ${this.options.timeoutMilliSeconds!}`;
            this.pushError!(trace, new ExecutionTimeoutError(message, timeTaken), args);
        }
    }

    private async pushError(trace: { stack?: string }, error: any, args: any[]) {
        error = Circuit.exceptionPipes.reduce((result, item) => item(result), error);
        // console.log(error);
        // console.log((trace as any).stack);

        if (await this.options.ignore?.(error, this)) return;
        // this.records.push({ error, time: new Date(), args, stack: trace?.stack });

        await this.options.onError?.(error, this);

        worker.pushError(this.id, error.constructor.name);
        if (this.state === CircuitBreakerState.HalfOpen) {
            this.state = CircuitBreakerState.Open;
            worker.setState(this.id, CircuitBreakerState.Open);
        }
    }
}

function _getCallerFile() {
    const err = new Error();

    Error.prepareStackTrace = (_, stack) => stack;
    const stack = err.stack;
    Error.prepareStackTrace = undefined;

    const paths: string[] = (stack as any)
        .filter((callSite: any) => {
            const file = callSite.getFileName() || '';
            return file && !file.match(/reflect-metadata/i) && !(callSite.getFunctionName() || '').toString().match(/__decorate/);
        })
        .map((callSite: any) => [path.relative(process.cwd(), callSite.getFileName() || ''), callSite.getLineNumber() || ''].join(':'));

    const idx = paths.findIndex((path) => path.match(/circuit-breaker.decorator/));
    if (idx < 0) throw new Error('CircuitBreaker: Call stack is ambiguous.');

    return paths[idx + 1];
}

export class CircuitBreakerManager {
    public static circuits: { [key: string]: Circuit } = {};

    static invoke(
        context: any,
        func: Function,
        funcName: string,
        options: CircuitBreakerOptions,
        trace: { stack?: string },
        ...args: any[]
    ) {
        let circuit: Circuit | undefined;
        if (options.scope === CircuitBreakerScope.INSTANCE) {
            if (!context.__circuit)
                Reflect.defineProperty(context, '__circuit', { value: [], writable: false, configurable: false, enumerable: false });

            circuit = context.__circuit.find((item: any) => item.func === func)?.circuit;
            if (!circuit) {
                circuit = new Circuit(_getCallerFile(), funcName, options);
                context.__circuit.push({ func, circuit });
                CircuitBreakerManager.circuits[circuit.id] = circuit;
            }
        } else {
            circuit = (func as any).__circuit;
            if (!(func as any).__circuit) {
                circuit = new Circuit(_getCallerFile(), funcName, options);
                Reflect.defineProperty(func, '__circuit', { value: circuit, writable: false, configurable: false, enumerable: false });
                CircuitBreakerManager.circuits[circuit.id] = circuit;
            }
        }

        return circuit!.invoke(context, func, trace, args);
    }

    static async terminate() {
        return worker.terminate();
    }
}

worker.setMetadataProvider((id: string) => {
    return CircuitBreakerManager.circuits[id]?.serializedOptions;
});

worker.setStateCallback(async (id: string, state: CircuitBreakerState): Promise<boolean> => {
    const circuit = CircuitBreakerManager.circuits[id];
    if (!circuit) return true;
    return circuit.setState(state);
});
