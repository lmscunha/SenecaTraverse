declare function sleep(ms: number): Promise<unknown>;
declare function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, { timeout, interval, }?: {
    timeout?: number;
    interval?: number;
}): Promise<T>;
declare function makeSeneca(opts?: any): any;
export { sleep, waitFor, makeSeneca };
