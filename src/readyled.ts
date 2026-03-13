export type ReadyLEDParams = {
    font?: string;
    pixelHeight: number;
    scrollSpeed?: number;
    target: HTMLElement;
    text: string;
}

const readyLED = (params: ReadyLEDParams) => {
    const { font, pixelHeight, scrollSpeed = 150, target, text } = params;
    const fontSize = 96;
    const renderWidth = Math.ceil(fontSize * 1.2 * text.length);
    const renderHeight = Math.ceil(fontSize * 0.9);
    const pixelWidth = Math.ceil(pixelHeight / renderHeight * renderWidth);

    const data = renderAndResampleText({
        width: renderWidth,
        height: renderHeight,
        text,
        fontSize,
        fontFamily: font ?? 'sans-serif',
        sampleHeight: pixelHeight,
        sampleWidth: pixelWidth,
        threshold: 128,
    });

    const sign = document.createElement('div');
    sign.classList.add('readyled-sign');

    renderSign({
        data,
        interval: scrollSpeed,
        sampleWidth: pixelWidth,
        signWidth: pixelWidth,
        target: sign as HTMLElement,
        width: pixelWidth,
        pixelSize: 1,
    });

    sign.style.width = `${pixelWidth}px`;
    target.appendChild(sign);
};

type RenderAndResampleTextParams = {
    width: number;
    height: number;
    text: string;
    fontFamily: string;
    fontSize: number;
    sampleWidth: number;
    sampleHeight: number;
    threshold?: number;
};

const renderAndResampleText = ({
    width,
    height,
    text,
    fontSize,
    fontFamily,
    sampleWidth,
    sampleHeight,
    threshold = 128 // luminance threshold for ON/OFF
}: RenderAndResampleTextParams): boolean[] => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return [];
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, height / 2);

    const src = ctx.getImageData(0, 0, width, height).data;
    const data = new Array(sampleWidth * sampleHeight);

    for (let y = 0; y < sampleHeight; y++) {
        for (let x = 0; x < sampleWidth; x++) {

            // Map low-res pixel to nearest source pixel
            const srcX = Math.floor((x / sampleWidth) * width);
            const srcY = Math.floor((y / sampleHeight) * height);

            const idx = (srcY * width + srcX) * 4;

            const r = src[idx] ?? 0;
            const g = src[idx + 1] ?? 0;
            const b = src[idx + 2] ?? 0;

            // Convert to grayscale luminance
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

            // Convert to ON/OFF bit
            data[y * sampleWidth + x] = luminance < threshold;
        }
    }

    return data;
};

const createPixel = (on: boolean, size: number = 1) => {
    const pixel = document.createElement('div');
    pixel.classList.add('readyled-pixel');
    if (on) {
        pixel.classList.add('readyled-pixel-on');
    }
    pixel.style.width = `${size}em`;
    pixel.style.height = `${size}em`;
    return pixel
};

type CreatePixelRowParams = {
    data: boolean[];
    rowIndex: number;
    rowSize: number;
    pixelSize: number;
};

const createPixelRow = ({data, rowIndex, rowSize, pixelSize}: CreatePixelRowParams) => {
    const row = document.createElement('div');
    row.classList.add('readyled-row');
    row.style.width = `${rowSize * 2}em`;
    const rowData = data.slice(rowIndex, rowIndex + rowSize);
    rowData.forEach((rowDatum: boolean) =>
        row.appendChild(createPixel(rowDatum, pixelSize))
    );
    return row;
};

type RenderSignParams = {
    target: HTMLElement;
    data: boolean[];
    width: number;
    signWidth: number;
    sampleWidth: number;
    pixelSize: number;
    interval: number;
};

const renderSign = function ({
    target,
    data,
    width,
    sampleWidth = Math.round(0.2 * width),
    pixelSize = 0.5,
    interval = 300,
}: RenderSignParams) {
    for (let i = 0, l = data.length - 1;
         i < l;
         i += sampleWidth) {
        const row = createPixelRow({
            data,
            rowIndex: i,
            rowSize: sampleWidth,
            pixelSize,
        });
        target.appendChild(row);
    }

    setInterval(() => {
        const rows = document.querySelectorAll('.readyled-row');
        for (let i = 0, l = rows.length; i < l; ++i) {
            const row = rows[i] as HTMLElement;
            const shiftPixel = row.firstElementChild;
            if (!shiftPixel) {
                continue;
            }
            row.appendChild(shiftPixel);
        }
    }, interval);
};

document.fonts.ready.then(() => {
    if (!document.body) {
        console.error('document.body not available');
        return;
    }
    readyLED({
        font: 'Elan',
        pixelHeight: 10,
        scrollSpeed: 200,
        target: document.body,
        text: `WE'RE READY TO BELIEVE YOU! (804) 482-1217 `,
    });
});