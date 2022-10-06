import { HttpStatus } from '@nestjs/common';
import { ErrorHttpStatusCode, HttpErrorByCode } from '@nestjs/common/utils/http-error-by-code.util';
import axios from 'axios';

export const AxiosExceptionPipe = (e: unknown) => {
    if (!axios.isAxiosError(e)) {
        return e;
    }

    const axiosErrorStatus: ErrorHttpStatusCode = ((): number => {
        if (e.code === 'ECONNABORTED' && e.message?.match(/timeout/i)) {
            return HttpStatus.REQUEST_TIMEOUT;
        }
        if (e.response?.status) {
            return e.response?.status;
        }
        if (e.status) {
            +e.status;
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    })();

    return new HttpErrorByCode[axiosErrorStatus](e.message);
};
