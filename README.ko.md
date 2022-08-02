# Circuit Breaker
- [Circuit Breaker pattern](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern)을 쉽게 적용할 수 있는 Decorator 
- **Node version >= 16**
  - Worker thread, BroadcastChannel를 활용합니다.

[![Node.js CI](https://github.com/kibae/node-circuit-breaker/actions/workflows/node.js.yml/badge.svg)](https://github.com/kibae/node-circuit-breaker/actions/workflows/node.js.yml)
[![NPM Version](https://badge.fury.io/js/node-circuit-breaker.svg)](https://www.npmjs.com/package/node-circuit-breaker)
[![License](https://img.shields.io/github/license/kibae/node-circuit-breaker)](https://github.com/kibae/node-circuit-breaker/blob/main/LICENSE)

## Install
- NPM
```shell
$ npm install node-circuit-breaker --save
```

- Yarn
```shell
$ yarn add node-circuit-breaker
```

- [Error Wrapper](#Error-Wrapper)를 활용하기 위해 `axios`, `@nestjs/common`, `typeorm` 패키지가 추가로 필요할 수 있습니다.

----
## API
### `@CircuitBreaker` Method Decorator
- Options

| Member                | Sub          | Type                                                     | Required | Description                                                                                                                                                                                                              |
|-----------------------|:-------------|----------------------------------------------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `fallback`            |              | `Function` `string` `Object`                             | required | CircuitBreaker state:Open 상태일 때 반환할 오류 또는 실행할 함수<br/><ul><li>*Function* : 지정된 함수를 대신 실행합니다.</li><li>*String* : 대신 실행할 현재 컨텍스트의 객체 내의 다른 method의 이름.<br/>eg) `xxxxFallback`</li><li>*Object* : 지정된 값을 즉시 응답합니다.</li></ul> |
| `rules`               |              | Array&lt;`CircuitBreakerRule`&gt;                        | required | state:Open을 판단하기 위한 규칙들                                                                                                                                                                                                  |
|                       | `exceptions` | Array&lt;typeof `Error`&gt;                              | required | Exception 목록                                                                                                                                                                                                             |
|                       | `times`      | number                                                   | required | 기준 시간 내 exception 횟수                                                                                                                                                                                                     |
|                       | `inSeconds`  | number                                                   | required | 기준 시간(초)                                                                                                                                                                                                                 |
| `fallbackForSeconds`  |              | number                                                   | required | state:Open -> state:HalfOpen 전까지 fallback으로 응답할 시간(초)                                                                                                                                                                    |
| `timeoutMilliSeconds` |              | number                                                   |          | method의 실행이 지정된 시간(ms)보다 오래 걸릴 경우 내부적으로 ExecutionTimeoutError를 생성한다. rules 내에 ExecutionTimeoutError를 정의하여 CircuitBreaker에 영향을 줄 수 있다.                                                                                    |
| `scope`               |              | `CircuitBreakerScope`                                    |          | <ul><li>`CircuitBreakerScope.DEFAULT` : 컨텍스트를 무시하고 해당 method에서 발생하는 exception을 모두 catch</li><li>`CircuitBreakerScope.INSTANCE` : 인스턴스 컨텍스트 내의 method에서 발생하는 exception만 catch</li></ul>                                   |
| `onCircuitOpen`       |              | (circuit: Circuit) => Promise&lt;boolean&gt;             |          | state:Open이 될 때 호출되는 콜백. false를 리턴할 경우 state 변경이 되지 않는다.                                                                                                                                                                 |
| `onCircuitClose`      |              | (circuit: Circuit) => Promise&lt;boolean&gt;             |          | state:Close가 될 때 호출되는 콜백. false를 리턴할 경우 state 변경이 되지 않는다.                                                                                                                                                                |
| `ignore`              |              | (error: any, circuit: Circuit) => Promise&lt;boolean&gt; |          | 에러가 발생했을때 호출되는 콜백. true가 리턴되면 에러가 무시되며, circuit에 영향을 주지 않는다.                                                                                                                                                             |
| `onError`             |              | (error: any, circuit: Circuit) => Promise&lt;void&gt;    |          | 에러가 발생했을때 호출되는 콜백.                                                                                                                                                                                                       |

### `CircuitBreakerManager`
 - `CircuitBreakerManager.terminate()`
   - CircuitBreaker Worker를 종료합니다. Worker가 종료되면 Circuit state 변경이 중지됩니다.

----

## Usage
```typescript
class Test {
  @CircuitBreaker({
    // state:Open일 경우 같은 인스턴스 내의 test1Fallback(...)를 실행합니다.
    fallback: 'test1Fallback',
    rules: [
      // TypeormQueryTimeoutError, RequestTimeoutException, GatewayTimeoutException
      // 에러가 60초 내에 10회 발생할 경우 state:Open이 되며 fallback이 수행됩니다. 
      {
        exceptions: [TypeormQueryTimeoutError, RequestTimeoutException, GatewayTimeoutException],
        times: 10,
        inSeconds: 60
      },
      // BadGatewayException, TypeormConnectionFailedError, ServiceUnavailableException
      // 에러가 5초 내에 30회 발생할 경우 state:Open이 되며 fallback이 수행됩니다.
      {
        exceptions: [BadGatewayException, TypeormConnectionFailedError, ServiceUnavailableException],
        times: 30,
        inSeconds: 5
      }
    ],
    // state:Open이 된 후 5초 후에 state:HalfOpen 상태가 되며 일부 호출이 정상적으로 수행됩니다.
    // 이 때 에러가 발생하는 경우 다시 state:Open으로 변경되며 5초 후에 다시 state:HalfOpen으로 변경됩니다.
    // state:HalfOpen 상태에서 정상적인 응답을 한 경우 state:Closed 상태가 됩니다.
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
    // method의 수행이 1000ms 이상이 걸리게 되면 ExecutionTimeoutError 에러가 기록됩니다.
    // ExecutionTimeoutError는 throw 되지 않으며 circuit breaker 내부로만 전달됩니다.
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
- 자주 쓰이는 기능들의 error wrapper를 제공합니다.
- 제공되는 Error Wrapper와 모든 종류의 Error를 `@CircuitBreaker({ rules[].exceptions[...] })`로 catch할 수 있습니다.

### ExecutionTimeoutError
- `@CircuitBreaker({...})` 에 `timeoutMilliSeconds`를 설정한 경우, 설정된 시간보다 해당 method 수행 시간이 긴 경우 `ExecutionTimeoutError`가 발생합니다.

### TypeORM
- `typeorm`이 설치된 경우 `QueryFailedError`를 세분화합니다.
- SQL 질의가 실패한 경우 접속 이슈인지 타임아웃인지 여부를 구분하여 에러를 캐치할 수 있습니다.

| Source Error       | Converted                      | Condition                                               |
|--------------------|--------------------------------|---------------------------------------------------------|
| `QueryFailedError` | `TypeormConnectionFailedError` | `QueryFailedError.driverError`에 `connection` 단어가 포함된 경우 |
| `QueryFailedError` | `TypeormQueryTimeoutError`     | `QueryFailedError.driverError`에 `timeout` 단어가 포함된 경우    |


### Axios -> Nestjs HttpException 
- Axios는 에러 발생 시 `AxiosError` 한가지 형태로 에러를 반환하기 때문에 exception filter에 활용하기 어렵습니다.
- `AxiosError`를 Nestjs의 `HttpException` 형태로 변환하여 CircuitBreaker의 룰로 활용하면 세밀한 룰 설정이 가능합니다.
- `axios`, `@nestjs/common` 패키지가 필요합니다. 
- [변환 규칙들](https://github.com/kibae/node-circuit-breaker/blob/main/src/exceptions/axios-extended-error.ts#L38)
