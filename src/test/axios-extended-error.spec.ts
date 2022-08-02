import Axios from 'axios';
import { AxiosExceptionPipe } from '../exceptions/axios-extended-error';
import { BadGatewayException, NotFoundException, RequestTimeoutException } from '@nestjs/common';

describe('AxiosExtendedError', () => {
    it('404 error', async () => {
        try {
            await Axios.get('https://httpstat.us/404');
        } catch (e) {
            expect(AxiosExceptionPipe(e as Error).constructor).toBe(NotFoundException);
        }
    });
    it('502 error', async () => {
        try {
            await Axios.get('https://httpstat.us/502');
        } catch (e) {
            expect(AxiosExceptionPipe(e as Error).constructor).toBe(BadGatewayException);
        }
    });
    it('Timeout error', async () => {
        try {
            await Axios.get('https://httpstat.us/200?sleep=3000', { timeout: 1000 });
        } catch (e) {
            expect(AxiosExceptionPipe(e as Error).constructor).toBe(RequestTimeoutException);
        }
    });
});
