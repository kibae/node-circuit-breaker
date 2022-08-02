export class ExecutionTimeoutError extends Error {
    constructor(message: string, public readonly timeTaken: number) {
        super(message);
    }
}
