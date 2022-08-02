import { Circuit, CircuitBreakerManager } from '../circuit-breaker-manager';
import { CircuitBreakerScope } from '../types/circuit.type';

export interface CircuitBreakerRule {
    exceptions: Array<typeof Error | any>;
    // thrown
    times: number;
    inSeconds: number;
}

export interface CircuitBreakerOptions {
    scope?: CircuitBreakerScope;
    fallback: Function | string | Object;
    ignore?: (error: any, circuit: Circuit) => Promise<boolean>;
    onError?: (error: any, circuit: Circuit) => Promise<void>;

    onCircuitOpen?: (circuit: Circuit) => Promise<boolean>;
    onCircuitClose?: (circuit: Circuit) => Promise<boolean>;

    timeoutMilliSeconds?: number;
    rules: CircuitBreakerRule[];

    fallbackForSeconds: number;
}

export function CircuitBreaker(options: CircuitBreakerOptions): MethodDecorator {
    options.timeoutMilliSeconds = options.timeoutMilliSeconds || 0;

    return function (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor | void {
        if (options.rules.length <= 0)
            throw new Error(`CircuitBreaker: [${target.constructor.name}.${propertyKey.toString()}] Rule(timeoutMs, exceptions) is empty.`);

        const func = descriptor.value;

        // const circuit = CircuitBreakerManager.createCircuit(target.constructor, propertyKey.toString(), func, options);

        descriptor.value = function (...args: any[]) {
            const trace: { stack?: string } = {};
            Error.captureStackTrace(trace);

            // @ts-ignore
            return CircuitBreakerManager.invoke(this, func, propertyKey.toString(), options, trace, ...args);
        } as any;

        return descriptor;
    };
}
