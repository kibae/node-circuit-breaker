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
let nestjsErrorConvert = (e: AxiosErrorLike) => e;

export declare class RequestUriTooLongException {}
export declare class TooManyRequestException {}

try {
    const axios = require('axios');
    const nestjs = require('@nestjs/common');

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

    nestjsErrorConvert = (e: AxiosErrorLike) => {
        switch (e.status || e.response?.status?.toString()) {
            case '400':
                return new nestjs.BadRequestException(e);
            case '401':
                return new nestjs.UnauthorizedException(e);
            case '403':
                return new nestjs.ForbiddenException(e);
            case '404':
                return new nestjs.NotFoundException(e);
            case '405':
                return new nestjs.MethodNotAllowedException(e);
            case '406':
                return new nestjs.NotAcceptableException(e);
            case '408':
                return new nestjs.RequestTimeoutException(e);
            case '409':
                return new nestjs.ConflictException(e);
            case '410':
                return new nestjs.GoneException(e);
            case '412':
                return new nestjs.PreconditionFailedException(e);
            case '413':
                return new nestjs.PayloadTooLargeException(e);
            case '414':
                return new RequestUriTooLongException(e);
            case '415':
                return new nestjs.UnsupportedMediaTypeException(e);
            case '418':
                return new nestjs.ImATeapotException(e);
            case '422':
                return new nestjs.UnprocessableEntityException(e);
            case '429':
                return new TooManyRequestException(e);
            case '500':
                return new nestjs.InternalServerErrorException(e);
            case '501':
                return new nestjs.NotImplementedException(e);
            case '502':
                return new nestjs.BadGatewayException(e);
            case '503':
                return new nestjs.ServiceUnavailableException(e);
            case '504':
                return new nestjs.GatewayTimeoutException(e);
            case '505':
                return new nestjs.HttpVersionNotSupportedException(e);
        }

        if (e.code === 'ECONNABORTED' && e.message?.match(/timeout/i)) return new nestjs.RequestTimeoutException(e);
        return e;
    };
} catch (e) {}

export const AxiosExceptionPipe = (e: Error): Error => {
    if (!(e instanceof axiosErrorLike)) return e;
    const error: AxiosErrorLike = e;

    return nestjsErrorConvert(error);
};
