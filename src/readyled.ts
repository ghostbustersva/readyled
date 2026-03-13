export type ReadyLEDParams = {
    font?: string;
    pixelHeight: number;
    scrollSpeed?: number;
    signWidth?: number;
    target: HTMLElement;
    text: string;
}

export const readyLED = (params: ReadyLEDParams) => {
    const { font, pixelHeight, scrollSpeed = 150, signWidth, target, text } = params;

    let sign;
    if (document.querySelector('.readyled-sign')) {
        sign = document.querySelector('.readyled-sign') as HTMLElement;
        if (sign) {
            sign.innerHTML = '';
        }
    } else {
        sign = document.createElement('div');
        sign.classList.add('readyled-sign');
    }

    const fontSize = 96;
    const renderWidth = Math.ceil(fontSize * 1.2 * text.length);
    const renderHeight = Math.ceil(fontSize * 0.9);
    const pixelWidth = Math.ceil(pixelHeight / renderHeight * renderWidth);

    const { data, width: clearedWidth } = renderAndResampleText({
        width: renderWidth,
        height: renderHeight,
        text,
        fontSize,
        fontFamily: font ?? 'sans-serif',
        sampleHeight: pixelHeight,
        sampleWidth: pixelWidth,
        threshold: 128,
    });

    renderSign({
        data,
        interval: scrollSpeed,
        sampleWidth: clearedWidth,
        signWidth: signWidth ?? pixelWidth,
        target: sign as HTMLElement,
        width: clearedWidth,
        pixelSize: 1,
    });

    sign.style.width = `${signWidth ?? pixelWidth}px`;
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
    text,
    fontSize,
    fontFamily,
    sampleWidth,
    sampleHeight,
    threshold = 128 // luminance threshold for ON/OFF
}: RenderAndResampleTextParams): { data: boolean[], width: number } => {
    const canvas = document.createElement('canvas');
    const width = canvas.width = Math.ceil(fontSize * 1.2 * text.length);
    const height = canvas.height = fontSize;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return { data: [], width };
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
        let columnData = [];
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
    const cleared = clearBlankColumns(data, sampleHeight, sampleWidth)
    return {
        data: cleared,
        width: cleared.length / sampleHeight,
    }
};

const clearBlankColumns = (data: boolean[], height: number, width: number) => {
    const cleared = data.slice();
    for (let i = width - 1; i >= 0; i--) {
        const columnData = [];
        for (let j = 0; j < height; j++) {
            const datum = cleared[j * i + i];
            columnData.push(datum);
        }
        const blankColumn = columnData.filter(d => d).length === 0;
        if (!blankColumn) {
            break;
        }
        for (let j = height - 1; j >= 0; j--) {
            cleared.splice(j * i + i, 1);
        }
    }
    return cleared;
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

    const text = ` WE'RE READY TO BELIEVE YOU! (804) 482-1217 -`;

    let config = {
        pixelHeight: 10,
        scrollSpeed: 150,
        signWidth: 320,
        target: document.body,
        text,
    };

    const readyLEDConfig = document.getElementById('readyled-config');
    if (readyLEDConfig) {
        config = {
            ...config,
            ...JSON.parse(readyLEDConfig.innerText),
        };
    }

    readyLED(config);
});