import { TypeormExceptionPipe, TypeormConnectionFailedError, TypeormQueryTimeoutError } from '../exceptions/typeorm-extended-error';
import { QueryFailedError } from 'typeorm';
import { ObjectUtils } from 'typeorm/util/ObjectUtils';

describe('TypeormExtendedError', () => {
    it('Normal? error', async () => {
        const error = TypeormExceptionPipe(new Error('Normal? error'));
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
            expect(error.message).toBe('Normal? error');
        } else {
            throw new Error('cannot occur');
        }
    });

    it('Normal? QueryFailedError', async () => {
        const driverError = new Error('relation "not_exists_table" does not exist');
        ObjectUtils.assign(driverError, {
            length: 115,
            name: 'error',
            severity: 'ERROR',
            code: '42P01',
            position: '15',
            file: 'parse_relation.c',
            line: '1381',
            routine: 'parserOpenTable',
        });
        const error = TypeormExceptionPipe(new QueryFailedError(`SELECT * FROM NOT_EXISTS_TABLE`, undefined, driverError));
        expect(error).toBeInstanceOf(QueryFailedError);
        expect(error instanceof QueryFailedError).toBeTruthy();
    });

    it('Connection error', async () => {
        const driverError = new Error('terminating connection due to administrator command');
        ObjectUtils.assign(driverError, {
            length: 116,
            name: 'error',
            severity: 'FATAL',
            code: '57P01',
            file: 'postgres.c',
            line: '3191',
            routine: 'ProcessInterrupts',
        });
        const error = TypeormExceptionPipe(new QueryFailedError(`SELECT pg_sleep(10)`, undefined, driverError));
        expect(error).toBeInstanceOf(TypeormConnectionFailedError);
        expect(error instanceof TypeormConnectionFailedError).toBeTruthy();
        expect(error instanceof QueryFailedError).toBeTruthy();
    });

    it('Timeout error', async () => {
        const driverError = new Error('Query read timeout');
        const error = TypeormExceptionPipe(new QueryFailedError(`SELECT pg_sleep(10)`, undefined, driverError));
        expect(error).toBeInstanceOf(TypeormQueryTimeoutError);
        expect(error instanceof TypeormQueryTimeoutError).toBeTruthy();
        expect(error instanceof QueryFailedError).toBeTruthy();
    });
});
