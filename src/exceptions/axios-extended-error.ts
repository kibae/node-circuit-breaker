// dummy
class AxiosErrorLike<T = unknown, D = any> extends Error {
    config!: any;
    code?: string;
    request?: any;
    response?: any;
    isAxiosError!: boolean;
    status?: string;
    constructor(message?: string, code?: string, config?: any, request?: any, response?: any) {
        super();
    }
}

let axiosErrorLike = AxiosErrorLike;
let transformError = (e: AxiosErrorLike) => e;

export declare class RequestUriTooLongException {}
export declare class TooManyRequestException {}

try {
    const axios = require('axios');
    const nestjs = require('@nestjs/common');
    const { HttpErrorByCode } = require('@nestjs/common/utils/http-error-by-code.util');

    if (axios?.AxiosError) axiosErrorLike = axios.AxiosError;

    class RequestUriTooLongException extends nestjs.HttpException {
        constructor(objectOrError?: string | object | any, description?: string) {
            super(nestjs.HttpException.createBody(objectOrError, description, 414), 414);
        }
    }

    class TooManyRequestException extends nestjs.HttpException {
        constructor(objectOrError?: string | object | any, description?: string) {
            super(nestjs.HttpException.createBody(objectOrError, description, 429), 429);
        }
    }

    transformError = (e: AxiosErrorLike) => {
        const axiosErrorStatus = ((): number => {
            if (e.code === 'ECONNABORTED' && e.message?.match(/timeout/i)) {
                return nestjs.HttpStatus.REQUEST_TIMEOUT;
            }
            if (e.response?.status) {
                return +e.response?.status;
            }
            if (e.status) {
                return +e.status;
            }
            return nestjs.HttpStatus.INTERNAL_SERVER_ERROR;
        })();

        if (HttpErrorByCode && HttpErrorByCode[axiosErrorStatus]) return new HttpErrorByCode[axiosErrorStatus](e.message);

        switch (axiosErrorStatus) {
            case 414:
                return new RequestUriTooLongException(e);
            case 429:
                return new TooManyRequestException(e);
        }

        return e;
    };
} catch (e) {}

export const AxiosExceptionPipe = (e: unknown): unknown => {
    if (!(e instanceof axiosErrorLike)) return e;
    const error: AxiosErrorLike = e;

    return transformError(error as AxiosErrorLike);
};
