# Circuit Breaker
- Decorators and tools that can easily apply the [Circuit Breaker pattern](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern).
- **Node version >= 16**
  - Depends on worker thread and BroadcastChannel.

[![NPM Version](https://badge.fury.io/js/node-circuit-breaker.svg)](https://www.npmjs.com/package/node-circuit-breaker)
[![License](https://img.shields.io/github/license/kibae/node-circuit-breaker)](https://github.com/kibae/node-circuit-breaker/blob/main/LICENSE)
----
[![Node.js(16) CI](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs16.yml/badge.svg)](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs16.yml)
[![Node.js(18) CI](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs18.yml/badge.svg)](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs18.yml)
[![Node.js(20) CI](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs20.yml/badge.svg)](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs20.yml)
[![Node.js(22) CI](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs22.yml/badge.svg)](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs22.yml)
[![Node.js(24) CI](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs24.yml/badge.svg)](https://github.com/kibae/node-circuit-breaker/actions/workflows/nodejs24.yml)

## Install
- NPM
```shell
$ npm install node-circuit-breaker --save
```

- Yarn
```shell
$ yarn add node-circuit-breaker
```

- You may need additional `axios`, `@nestjs/common`, and `typeorm` packages to use the [Error Wrapper](#Error-Wrapper).

----
## API
### `@CircuitBreaker` Method Decorator
- Options

| Member                | Sub          | Type                                                     | Required | Description                                                                                                                                                                                                                                                                                                                                             |
|-----------------------|:-------------|----------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `fallback`            |              | `Function` `string` `Object`                             | required | An error object to return or a function to run when CircuitBreaker state:Open<br/><ul><li>*Function* : Executes the specified function instead.</li><li>*String* : The name of another method within the object in the current context to execute instead.<br/>eg) `xxxxFallback`</li><li>*Object* : Returns the specified value immediately.</li></ul> |
| `rules`               |              | Array&lt;`CircuitBreakerRule`&gt;                        | required | Rules for determining state:Open                                                                                                                                                                                                                                                                                                                        |
|                       | `exceptions` | Array&lt;typeof `Error`&gt;                              | required | Exception list                                                                                                                                                                                                                                                                                                                                          |
|                       | `times`      | number                                                   | required | Number of exceptions within the period                                                                                                                                                                                                                                                                                                                  |
|                       | `inSeconds`  | number                                                   | required | Period(seconds) for counting exceptions                                                                                                                                                                                                                                                                                                                 |
| `fallbackForSeconds`  |              | number                                                   | required | Period(seconds) to respond with fallback before Open -> HalfOpen                                                                                                                                                                                                                                                                                        |
| `timeoutMilliSeconds` |              | number                                                   |          | If the execution of the method takes longer than the specified time (ms), ExecutionTimeoutError is generated internally. You can use ExecutionTimeoutError in CircuitBreaker rules.                                                                                                                                                                     |
| `scope`               |              | `CircuitBreakerScope`                                    |          | <ul><li>`CircuitBreakerScope.DEFAULT` : Ignore the context and catch all exceptions raised by the method</li><li>`CircuitBreakerScope.INSTANCE` : Catch only exceptions that occur in methods within instance context</li></ul>                                                                                                                         |
| `onCircuitOpen`       |              | (circuit: Circuit) => Promise&lt;boolean&gt;             |          | A callback called when state changes to Open. If false is returned, the state is not changed.                                                                                                                                                                                                                                                           |
| `onCircuitClose`      |              | (circuit: Circuit) => Promise&lt;boolean&gt;             |          | A callback called when state changes to Closed. If false is returned, the state is not changed.                                                                                                                                                                                                                                                         |
| `ignore`              |              | (error: any, circuit: Circuit) => Promise&lt;boolean&gt; |          | A callback that is called when an error occurs. If true is returned, the error is ignored and the circuit is not affected.                                                                                                                                                                                                                              |
| `onError`             |              | (error: any, circuit: Circuit) => Promise&lt;void&gt;    |          | A callback that is called when an error occurs.                                                                                                                                                                                                                                                                                                         |

### `CircuitBreakerManager`
- `CircuitBreakerManager.terminate()`
    - Terminate CircuitBreaker Worker. Circuit state change stops.

----

## Usage
```typescript
class Test {
  @CircuitBreaker({
    // If state:Open, execute test1Fallback(...) within the same instance.
    fallback: 'test1Fallback',
    rules: [
      // TypeormQueryTimeoutError, RequestTimeoutException, GatewayTimeoutException
      // If an error occurs 10 times within 60 seconds, state:Open is set and a fallback is performed. 
      {
        exceptions: [TypeormQueryTimeoutError, RequestTimeoutException, GatewayTimeoutException],
        times: 10,
        inSeconds: 60
      },
      // BadGatewayException, TypeormConnectionFailedError, ServiceUnavailableException
      // If an error occurs 30 times within 5 seconds, state:Open is set and fallback is performed.
      {
        exceptions: [BadGatewayException, TypeormConnectionFailedError, ServiceUnavailableException],
        times: 30,
        inSeconds: 5
      }
    ],
    // After state:Open, it becomes state:HalfOpen after 5 seconds, and some calls are performed normally.
    // If an error occurs at this time, it changes back to state:Open, and then changes to state:HalfOpen again after 5 seconds.
    // If a normal response is made in state:HalfOpen state, it becomes state:Closed state.
    fallbackForSeconds: 5,
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
    // If the method takes more than 1000ms to execute, an ExecutionTimeoutError error is generated.
    // ExecutionTimeoutError is not thrown, only passed inside the circuit breaker.
    timeoutMilliSeconds: 1000,
    rules: [
      { exceptions: [BadGatewayException], times: 10, inSeconds: 5 },
      { exceptions: [ExecutionTimeoutError], times: 3, inSeconds: 10 }
    ],
    fallbackForSeconds: 3,
  })
  test2(arg: string) {
    if (arg === 'error') throw new BadGatewayException();
    return arg;
  }
}

class TestFallback {
  static test2(arg: string) {
    return arg;
  }
}
```


----

## Contributors
<a href="https://github.com/kibae/node-circuit-breaker/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=kibae/node-circuit-breaker" />
</a>

----
## Error Wrapper
- Provides error wrappers for frequently used functions.
- The provided Error Wrapper and all kinds of Errors can be caught by `@CircuitBreaker({ rules[].exceptions[...] })`.

### ExecutionTimeoutError
- `@CircuitBreaker({...})` If `timeoutMilliSeconds` is set, `ExecutionTimeoutError` occurs if the execution time of the method is longer than the set time.

### TypeORM
- Refines `QueryFailedError` if `typeorm` is installed.
- If the SQL query fails, you can catch the error by identifying whether it is a connection issue or a timeout.

| Source Error       | Converted                      | Condition                                            |
|--------------------|--------------------------------|------------------------------------------------------|
| `QueryFailedError` | `TypeormConnectionFailedError` | `QueryFailedError.driverError` contains `connection` |
| `QueryFailedError` | `TypeormQueryTimeoutError`     | `QueryFailedError.driverError` contains `timeout`    |


### Axios -> Nestjs HttpException
- Axios returns an error in the form of `AxiosError` when an error occurs, so it is difficult to use in exception filter.
- By converting `AxiosError` into `HttpException` form of Nestjs and using it as a rule of CircuitBreaker, detailed rule setting is possible.
- Requires `axios`, `@nestjs/common` packages.
- [Transform rules](https://github.com/kibae/node-circuit-breaker/blob/main/src/exceptions/axios-extended-error.ts#L38)
