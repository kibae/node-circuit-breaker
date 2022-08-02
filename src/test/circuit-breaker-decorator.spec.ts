import { CircuitBreaker } from '../decorators/circuit-breaker.decorator';
import { CircuitBreakerManager } from '../circuit-breaker-manager';
import { BadGatewayException } from '@nestjs/common';
import { CircuitBreakerScope } from '../types/circuit.type';

class TestFallback {
    static test2(arg: string) {
        return arg;
    }
}

class Test {
    rand = Math.random();

    @CircuitBreaker({
        // scope: CircuitBreakerScope.INSTANCE,
        fallback: 'test1Fallback',
        rules: [{ exceptions: [BadGatewayException], times: 10, inSeconds: 1 }],
        fallbackForSeconds: 1,
    })
    test1(arg: string) {
        if (arg === 'error') throw new BadGatewayException();
        return arg;
    }

    test1Fallback(arg: string) {
        return 'fallback';
    }

    @CircuitBreaker({
        scope: CircuitBreakerScope.INSTANCE,
        fallback: TestFallback.test2,
        rules: [{ exceptions: [BadGatewayException], times: 10, inSeconds: 1 }],
        fallbackForSeconds: 1,
    })
    test2(arg: string) {
        if (arg === 'error') throw new BadGatewayException();
        return arg;
    }
}

describe('CircuitBreakerDecorator', () => {
    beforeAll(async () => {
        // wait worker initialize
        await new Promise((resolve) => setTimeout(resolve, 100));
    });

    afterAll(async () => {
        await CircuitBreakerManager.terminate();
    });

    it('Circuit Open', async () => {
        const instance = new Test();

        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('test');
        }

        for (let i = 0; i < 10; i++) {
            try {
                instance.test1('error');
                expect(true).toBeFalsy();
            } catch (e: any) {
                expect(e.constructor).toBe(BadGatewayException);
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('fallback');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('test');
        }
    });

    it('Circuit HalfOpen', async () => {
        const instance = new Test();

        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('test');
        }

        for (let i = 0; i < 10; i++) {
            try {
                instance.test1('error');
                expect(true).toBeFalsy();
            } catch (e: any) {
                expect(e.constructor).toBe(BadGatewayException);
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('fallback');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
            instance.test1('error');
            expect(true).toBeFalsy();
        } catch (e: any) {
            expect(e.constructor).toBe(BadGatewayException);
        }
        await new Promise((resolve) => setImmediate(resolve));
        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('fallback');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        for (let i = 0; i < 10; i++) {
            expect(instance.test1('test')).toBe('test');
        }
    });

    it('Per instance', async () => {
        const instance1 = new Test();
        const instance2 = new Test();

        for (let i = 0; i < 10; i++) {
            expect(instance1.test1('test')).toBe('test');
            expect(instance1.test2('test')).toBe('test');
            expect(instance2.test1('test')).toBe('test');
            expect(instance2.test2('test')).toBe('test');
        }

        for (let i = 0; i < 9; i++) {
            try {
                instance1.test1('error');
                expect(true).toBeFalsy();
            } catch (e: any) {
                expect(e.constructor).toBe(BadGatewayException);
            }
            try {
                instance1.test2('error');
                expect(true).toBeFalsy();
            } catch (e: any) {
                expect(e.constructor).toBe(BadGatewayException);
            }
            try {
                instance2.test1('error');
                expect(true).toBeFalsy();
            } catch (e: any) {
                expect(e.constructor).toBe(BadGatewayException);
            }
            try {
                instance2.test2('error');
                expect(true).toBeFalsy();
            } catch (e: any) {
                expect(e.constructor).toBe(BadGatewayException);
            }
        }

        // console.log(CircuitBreakerManager.circuits);

        await new Promise((resolve) => setTimeout(resolve, 100));

        for (let i = 0; i < 10; i++) {
            expect(instance1.test1('test')).toBe('fallback');
            expect(instance1.test2('test')).toBe('test');
            expect(instance2.test1('test')).toBe('fallback');
            expect(instance2.test2('test')).toBe('test');
        }
    });
});
