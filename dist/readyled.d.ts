export type ReadyLEDParams = {
    fallbackFont?: string;
    font?: string;
    fontCheckInterval?: number;
    maxWait?: number;
    pixelHeight: number;
    renderFontSize?: number;
    scrollSpeed?: number;
    signWidth?: number;
    target: HTMLElement;
    text: string;
};
export declare const readyLED: (params: ReadyLEDParams) => Promise<void>;
