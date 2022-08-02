// dummy
class TypeormQueryFailedErrorLike extends Error {
    readonly query!: string;
    readonly parameters!: any[] | undefined;
    readonly driverError!: any;
    constructor(query: string, parameters: any[] | undefined, driverError: any) {
        super();
    }
}

let TypeormQueryFailedError = TypeormQueryFailedErrorLike;

try {
    const _ = require('typeorm/error/QueryFailedError');
    if (_?.QueryFailedError) TypeormQueryFailedError = _.QueryFailedError;
} catch (e) {}

export class TypeormConnectionFailedError extends TypeormQueryFailedError {}
export class TypeormQueryTimeoutError extends TypeormQueryFailedError {}

export const TypeormExceptionPipe = (e: Error): Error => {
    if (!(e instanceof TypeormQueryFailedError)) return e;
    const error: TypeormQueryFailedErrorLike = e;

    const driverError: string = (error as any).driverError?.toString();
    if (driverError) {
        if (driverError.match(/connection\s|\sconnection/i))
            return new TypeormConnectionFailedError(error.query, error.parameters, error.driverError);
        else if (driverError.match(/timeout\s|\stimeout/i))
            return new TypeormQueryTimeoutError(error.query, error.parameters, error.driverError);
    }

    return error;
};
