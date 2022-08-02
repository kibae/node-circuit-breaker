export enum CircuitBreakerScope {
    /**
     * global
     */
    DEFAULT = 0,

    /**
     * per instance
     */
    INSTANCE = 1,
}

export enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}
