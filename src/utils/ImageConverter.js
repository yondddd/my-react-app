import piexif from 'piexifjs';
// You must import the pako library for compression to work.
// You can get it from a CDN, e.g.: <script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"></script>
import pako from 'pako';

/**
 * Defines the data types for TIFF tags as per the specification.
 * @private
 */
const TIFF_TYPES = {
    ASCII: 2,
    SHORT: 3,
    LONG: 4,
    RATIONAL: 5,
};

/**
 * Defines commonly used TIFF tag codes for readability.
 * @private
 */
const TIFF_TAGS = {
    ImageWidth: 256,
    ImageLength: 257,
    BitsPerSample: 258,
    Compression: 259,
    PhotometricInterpretation: 262,
    StripOffsets: 273,
    SamplesPerPixel: 277,
    StripByteCounts: 279,
    XResolution: 282,
    YResolution: 283,
    ResolutionUnit: 296,
    Software: 305,
    DateTime: 306,
};

/**
 * Reusable Image Converter Utility
 * Provides methods to convert images between different formats with proper DPI metadata.
 * Creates compressed TIFF files using a direct, single-step method.
 */
export class ImageConverter {
    /**
     * Convert SVG string to Canvas with DPI scaling
     * @param {string} svgString - SVG content as string
     * @param {number} dpi - Target DPI (72, 150, or 300)
     * @returns {Promise<HTMLCanvasElement>} Canvas element
     */
    static async svgToCanvas(svgString, dpi = 72) {
        return new Promise((resolve, reject) => {
            try {
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
                const svgUrl = URL.createObjectURL(svgBlob);

                const img = new Image();
                img.crossOrigin = 'anonymous';

                img.onload = () => {
                    try {
                        const dimensions = this.getSvgDimensions(svgString);
                        let width = dimensions?.width || img.naturalWidth || 300;
                        let height = dimensions?.height || img.naturalHeight || 300;

                        const scale = dpi / 72;
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d', { 
                            alpha: false,
                            willReadFrequently: false 
                        });

                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, width, height);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(img, 0, 0, width, height);

                        URL.revokeObjectURL(svgUrl);
                        resolve(canvas);
                    } catch (error) {
                        URL.revokeObjectURL(svgUrl);
                        reject(error);
                    }
                };

                img.onerror = () => {
                    URL.revokeObjectURL(svgUrl);
                    reject(new Error('Failed to load SVG image'));
                };

                img.src = svgUrl;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Add DPI metadata to PNG data using proper PNG chunks
     * @param {Uint8Array} pngData - PNG data
     * @param {number} dpi - DPI value
     * @returns {Uint8Array} PNG data with DPI metadata
     */
    static addPngDpiChunk(pngData, dpi) {
        try {
            if (pngData.length < 8 || pngData[0] !== 0x89 || pngData[1] !== 0x50 || pngData[2] !== 0x4E || pngData[3] !== 0x47 || pngData[4] !== 0x0D || pngData[5] !== 0x0A || pngData[6] !== 0x1A || pngData[7] !== 0x0A) {
                throw new Error('Invalid PNG signature');
            }
            const pixelsPerMeter = Math.round(dpi * 39.3701);
            const physData = new Uint8Array(9);
            const dataView = new DataView(physData.buffer);
            dataView.setUint32(0, pixelsPerMeter, false);
            dataView.setUint32(4, pixelsPerMeter, false);
            dataView.setUint8(8, 1);
            const crc = ImageConverter.calculateCRC32(new Uint8Array([0x70, 0x48, 0x59, 0x73, ...physData]));
            const physChunk = new Uint8Array(12 + 9);
            const chunkView = new DataView(physChunk.buffer);
            chunkView.setUint32(0, 9, false);
            physChunk.set([0x70, 0x48, 0x59, 0x73], 4);
            physChunk.set(physData, 8);
            chunkView.setUint32(17, crc, false);
            let insertPos = 8;
            let foundIHDR = false;
            while (insertPos < pngData.length - 8) {
                const chunkLength = new DataView(pngData.buffer, insertPos).getUint32(0, false);
                const chunkType = String.fromCharCode(...pngData.slice(insertPos + 4, insertPos + 8));
                if (chunkType === 'IHDR') {
                    foundIHDR = true;
                    insertPos += 12 + chunkLength;
                    break;
                }
                insertPos += 12 + chunkLength;
            }
            if (!foundIHDR) {
                throw new Error('IHDR chunk not found');
            }
            const result = new Uint8Array(pngData.length + physChunk.length);
            result.set(pngData.slice(0, insertPos));
            result.set(physChunk, insertPos);
            result.set(pngData.slice(insertPos), insertPos + physChunk.length);
            return result;
        } catch (error) {
            console.warn('Failed to add DPI metadata to PNG:', error);
            return pngData;
        }
    }

    /**
     * Calculate CRC32 for PNG chunk
     * @param {Uint8Array} data - Data to calculate CRC for
     * @returns {number} CRC32 value
     */
    static calculateCRC32(data) {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Convert Canvas to PNG Blob with DPI metadata
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} dpi - DPI value for metadata
     * @param {number} quality - Quality (0-1, default 1)
     * @returns {Promise<Blob>} PNG blob with DPI metadata
     */
    static async canvasToPng(canvas, dpi = 72, quality = 1) {
        return new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
                try {
                    const arrayBuffer = await blob.arrayBuffer();
                    const pngData = new Uint8Array(arrayBuffer);
                    const pngWithDpi = ImageConverter.addPngDpiChunk(pngData, dpi);
                    resolve(new Blob([pngWithDpi], { type: 'image/png' }));
                } catch (error) {
                    console.warn('Failed to add DPI metadata to PNG:', error);
                    resolve(blob);
                }
            }, 'image/png', quality);
        });
    }

    /**
     * Convert Canvas to JPEG Blob with DPI metadata
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {number} dpi - DPI value for metadata
     * @param {number} quality - Quality (0-1, default 0.9)
     * @returns {Promise<Blob>} JPEG blob with DPI metadata
     */
    static async canvasToJpeg(canvas, dpi = 72, quality = 0.9) {
        return new Promise(async (resolve) => {
            try {
                const exifObj = {
                    '0th': {
                        [piexif.ImageIFD.XResolution]: [dpi, 1],
                        [piexif.ImageIFD.YResolution]: [dpi, 1],
                        [piexif.ImageIFD.ResolutionUnit]: 2,
                        [piexif.ImageIFD.Software]: 'SVG Converter',
                        [piexif.ImageIFD.DateTime]: this.formatDateTime()
                    },
                    'Exif': {
                        [piexif.ExifIFD.PixelXDimension]: canvas.width,
                        [piexif.ExifIFD.PixelYDimension]: canvas.height,
                        [piexif.ExifIFD.DateTimeOriginal]: this.formatDateTime(),
                        [piexif.ExifIFD.DateTimeDigitized]: this.formatDateTime()
                    }
                };
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const exifBytes = piexif.dump(exifObj);
                const jpegWithExif = piexif.insert(exifBytes, dataUrl);
                const base64Data = jpegWithExif.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                try {
                    const jpegWithDpi = this.setJfifDpi(bytes, dpi);
                    resolve(new Blob([jpegWithDpi], { type: 'image/jpeg' }));
                } catch (error) {
                    console.warn('Failed to set JFIF DPI, using EXIF only:', error);
                    resolve(new Blob([bytes], { type: 'image/jpeg' }));
                }
            } catch (error) {
                console.error('JPEG conversion error:', error);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            }
        });
    }

    /**
     * Set DPI in JFIF segment of JPEG
     * @param {Uint8Array} jpegData - JPEG data
     * @param {number} dpi - DPI value
     * @returns {Uint8Array} JPEG data with updated DPI
     */
    static setJfifDpi(jpegData, dpi) {
        if (jpegData[0] !== 0xFF || jpegData[1] !== 0xD8) {
            throw new Error('Invalid JPEG: missing SOI marker');
        }
        let jfifIndex = -1;
        let offset = 2;
        while (offset < jpegData.length - 1) {
            if (jpegData[offset] !== 0xFF) break;
            const marker = jpegData[offset + 1];
            if (marker >= 0xE0 && marker <= 0xEF) {
                const segmentLength = (jpegData[offset + 2] << 8) | jpegData[offset + 3];
                if (offset + 5 < jpegData.length && jpegData[offset + 4] === 0x4A && jpegData[offset + 5] === 0x46 && jpegData[offset + 6] === 0x49 && jpegData[offset + 7] === 0x46 && jpegData[offset + 8] === 0x00) {
                    jfifIndex = offset;
                    break;
                }
                offset += 2 + segmentLength;
            } else {
                break;
            }
        }
        const result = new Uint8Array(jpegData);
        if (jfifIndex !== -1) {
            result[jfifIndex + 11] = 1;
            result[jfifIndex + 12] = (dpi >> 8) & 0xFF;
            result[jfifIndex + 13] = dpi & 0xFF;
            result[jfifIndex + 14] = (dpi >> 8) & 0xFF;
            result[jfifIndex + 15] = dpi & 0xFF;
        } else {
            const jfifSegment = new Uint8Array([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, (dpi >> 8) & 0xFF, dpi & 0xFF, (dpi >> 8) & 0xFF, dpi & 0xFF, 0x00, 0x00]);
            const newData = new Uint8Array(jpegData.length + jfifSegment.length);
            newData.set(jpegData.slice(0, 2), 0);
            newData.set(jfifSegment, 2);
            newData.set(jpegData.slice(2), 18);
            return newData;
        }
        return result;
    }

    /**
     * Format date for image metadata
     * @param {Date} date - Date object
     * @returns {string} Formatted date string
     */
    static formatDateTime(date = new Date()) {
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${Y}:${M}:${D} ${h}:${m}:${s}`;
    }

    /**
     * [OPTIMIZED] Converts a Canvas to a Deflate-compressed TIFF using pako for compression
     * and a manual writer for file structure to ensure stability and maintainability.
     * @param {HTMLCanvasElement} canvas - The canvas to convert.
     * @param {number} dpi - The DPI for the output image.
     * @returns {Promise<Uint8Array>} A promise that resolves with the compressed TIFF data.
     */
    static async canvasToTiff(canvas, dpi = 96) {
        return new Promise((resolve, reject) => {
            try {
                const ctx = canvas.getContext("2d");
                if (!ctx) throw new Error("Could not get 2D context from canvas");

                // 1. Prepare Pixel Data
                const { width, height } = canvas;
                const rgbaData = ctx.getImageData(0, 0, width, height).data;
                const rgbData = this._rgbaToRgb(rgbaData);
                const compressedData = pako.deflate(rgbData);

                // 2. Define TIFF Tags
                const entries = this._createTiffTagEntries(width, height, dpi, compressedData.length);

                // 3. Build the TIFF File Buffer
                const fileBuffer = this._buildTiffBuffer(entries, compressedData);

                resolve(new Uint8Array(fileBuffer));
            } catch (err) {
                console.error("Failed to create compressed TIFF:", err);
                reject(err);
            }
        });
    }

    /**
     * Converts RGBA pixel data to RGB, blending transparency with a white background.
     * @private
     */
    static _rgbaToRgb(rgbaData) {
        const rgbData = new Uint8Array(rgbaData.length / 4 * 3);
        for (let i = 0, j = 0; i < rgbaData.length; i += 4, j += 3) {
            const alpha = rgbaData[i + 3] / 255;
            rgbData[j]     = Math.round(rgbaData[i]     * alpha + 255 * (1 - alpha));
            rgbData[j + 1] = Math.round(rgbaData[i + 1] * alpha + 255 * (1 - alpha));
            rgbData[j + 2] = Math.round(rgbaData[i + 2] * alpha + 255 * (1 - alpha));
        }
        return rgbData;
    }

    /**
     * Creates the array of tag entries for the TIFF Image File Directory (IFD).
     * @private
     */
    static _createTiffTagEntries(width, height, dpi, compressedDataLength) {
        return [
            { tag: TIFF_TAGS.ImageWidth, type: TIFF_TYPES.LONG, count: 1, value: width },
            { tag: TIFF_TAGS.ImageLength, type: TIFF_TYPES.LONG, count: 1, value: height },
            { tag: TIFF_TAGS.BitsPerSample, type: TIFF_TYPES.SHORT, count: 3, value: [8, 8, 8] },
            { tag: TIFF_TAGS.Compression, type: TIFF_TYPES.SHORT, count: 1, value: 8 }, // 8 = Deflate
            { tag: TIFF_TAGS.PhotometricInterpretation, type: TIFF_TYPES.SHORT, count: 1, value: 2 }, // 2 = RGB
            { tag: TIFF_TAGS.StripOffsets, type: TIFF_TYPES.LONG, count: 1, value: 0 }, // Placeholder
            { tag: TIFF_TAGS.SamplesPerPixel, type: TIFF_TYPES.SHORT, count: 1, value: 3 },
            { tag: TIFF_TAGS.StripByteCounts, type: TIFF_TYPES.LONG, count: 1, value: compressedDataLength },
            { tag: TIFF_TAGS.XResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: [dpi, 1] },
            { tag: TIFF_TAGS.YResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: [dpi, 1] },
            { tag: TIFF_TAGS.ResolutionUnit, type: TIFF_TYPES.SHORT, count: 1, value: 2 }, // 2 = Inch
            { tag: TIFF_TAGS.Software, type: TIFF_TYPES.ASCII, count: 0, value: 'ImageConverter.js' },
            { tag: TIFF_TAGS.DateTime, type: TIFF_TYPES.ASCII, count: 0, value: this.formatDateTime() },
        ];
    }

    /**
     * Assembles the complete TIFF file buffer from its constituent parts.
     * @private
     */
    static _buildTiffBuffer(entries, compressedData) {
        const lsb = false; // false = Big Endian (MM)
        const dataBlocks = [];
        let dataOffset = 8 + 2 + (entries.length * 12) + 4; // Header + IFD Entry Count + IFD Entries + End Pointer

        // Calculate offsets for data that doesn't fit in the IFD entry itself
        for (const entry of entries) {
            let valueByteLength;
            if (entry.type === TIFF_TYPES.ASCII) {
                entry.value += '\0'; // Null-terminate strings
                entry.count = entry.value.length;
                valueByteLength = entry.count;
            } else {
                valueByteLength = { [TIFF_TYPES.SHORT]: 2, [TIFF_TYPES.LONG]: 4, [TIFF_TYPES.RATIONAL]: 8 }[entry.type] * entry.count;
            }

            if (valueByteLength > 4) {
                dataBlocks.push({ offset: dataOffset, data: entry.value, type: entry.type });
                entry.value = dataOffset;
                dataOffset += valueByteLength;
                if (dataOffset % 2 !== 0) dataOffset++; // Align to word boundary
            }
        }

        const imageDataOffset = dataOffset;
        entries.find(e => e.tag === TIFF_TAGS.StripOffsets).value = imageDataOffset;

        const fileLength = imageDataOffset + compressedData.length;
        const fileBuffer = new ArrayBuffer(fileLength);
        const view = new DataView(fileBuffer);
        let pos = 0;

        const set16 = (p, d) => view.setUint16(p, d, lsb);
        const set32 = (p, d) => view.setUint32(p, d, lsb);

        // --- Write Header ---
        set16(pos, 0x4D4D); pos += 2; // MM for Big Endian
        set16(pos, 42); pos += 2;     // TIFF Magic Number
        set32(pos, 8); pos += 4;      // Offset to first IFD

        // --- Write IFD ---
        set16(pos, entries.length); pos += 2;
        for (const entry of entries) {
            set16(pos, entry.tag); pos += 2;
            set16(pos, entry.type); pos += 2;
            set32(pos, entry.count); pos += 4;

            let valueByteLength = (entry.type === TIFF_TYPES.ASCII) ? entry.count : { [TIFF_TYPES.SHORT]: 2, [TIFF_TYPES.LONG]: 4, [TIFF_TYPES.RATIONAL]: 8 }[entry.type] * entry.count;

            if (valueByteLength <= 4) {
                if (entry.type === TIFF_TYPES.SHORT) {
                    set16(pos, entry.value);
                    set16(pos + 2, 0); // Pad
                } else {
                    set32(pos, entry.value);
                }
                pos += 4;
            } else {
                set32(pos, entry.value); pos += 4;
            }
        }
        set32(pos, 0); // End of IFD chain

        // --- Write Data Blocks (for DPI, strings, etc.) ---
        for (const block of dataBlocks) {
            pos = block.offset;
            if (block.type === TIFF_TYPES.RATIONAL) {
                set32(pos, block.data[0]); pos += 4;
                set32(pos, block.data[1]); pos += 4;
            } else if (block.type === TIFF_TYPES.SHORT) {
                for(let i=0; i < block.data.length; i++) {
                    set16(pos, block.data[i]); pos += 2;
                }
            } else if (block.type === TIFF_TYPES.ASCII) {
                for (let i = 0; i < block.data.length; i++) {
                    view.setUint8(pos++, block.data.charCodeAt(i));
                }
            }
        }

        // --- Write Compressed Pixel Data ---
        new Uint8Array(fileBuffer).set(compressedData, imageDataOffset);

        return fileBuffer;
    }


    /**
     * Convert SVG to specified format with DPI
     * @param {string} svgString - SVG content
     * @param {string} format - Output format ('png', 'jpg', 'tiff')
     * @param {number} dpi - Target DPI (72, 150, or 300)
     * @param {number} quality - Quality for lossy formats (0-1)
     * @returns {Promise<{data: Blob|Uint8Array, mimeType: string, canvas: HTMLCanvasElement}>}
     */
    static async convertSvg(svgString, format, dpi = 72, quality = 0.9) {
        if (!svgString || typeof svgString !== 'string') {
            throw new Error('Invalid SVG string provided');
        }
        if (!this.isValidSvg(svgString)) {
            throw new Error('Invalid SVG content');
        }
        if (dpi <= 0 || dpi > 1200) {
            throw new Error('DPI must be between 1 and 1200');
        }
        if (quality < 0 || quality > 1) {
            throw new Error('Quality must be between 0 and 1');
        }

        try {
            const canvas = await this.svgToCanvas(svgString, dpi);

            switch (format.toLowerCase()) {
                case 'png':
                    return {
                        data: await this.canvasToPng(canvas, dpi, quality),
                        mimeType: 'image/png',
                        canvas
                    };
                case 'jpeg':
                case 'jpg':
                    return {
                        data: await this.canvasToJpeg(canvas, dpi, quality),
                        mimeType: 'image/jpeg',
                        canvas
                    };
                case 'tiff':
                case 'tif':
                    // Directly create the compressed TIFF.
                    const compressedTiff = await this.canvasToTiff(canvas, dpi);
                    return {
                        data: compressedTiff,
                        mimeType: 'image/tiff',
                        canvas
                    };
                default:
                    throw new Error(`Unsupported format: ${format}. Supported formats: png, jpg, jpeg, tiff, tif`);
            }
        } catch (error) {
            throw new Error(`Conversion failed: ${error.message}`);
        }
    }

    /**
     * Download file from blob or array buffer
     * @param {Blob|Uint8Array} data - File data
     * @param {string} filename - Filename with extension
     * @param {string} mimeType - MIME type
     */
    static downloadFile(data, filename, mimeType) {
        if (!data) {
            throw new Error('No data provided for download');
        }
        if (!filename || typeof filename !== 'string') {
            throw new Error('Invalid filename provided');
        }
        if (!mimeType || typeof mimeType !== 'string') {
            throw new Error('Invalid MIME type provided');
        }
        try {
            const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Validate SVG content
     * @param {string} svgString - SVG content to validate
     * @returns {boolean} True if valid SVG
     */
    static isValidSvg(svgString) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            const parserError = doc.getElementsByTagName('parsererror');
            return parserError.length === 0 && doc.documentElement.tagName === 'svg';
        } catch {
            return false;
        }
    }

    /**
     * Get SVG dimensions from content
     * @param {string} svgString - SVG content
     * @returns {{width: number, height: number} | null} Dimensions or null if not found
     */
    static getSvgDimensions(svgString) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            const svg = doc.documentElement;
            if (svg.tagName !== 'svg') return null;
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            const viewBox = svg.getAttribute('viewBox');
            if (width && height) {
                return {
                    width: parseInt(width),
                    height: parseInt(height)
                };
            } else if (viewBox) {
                const values = viewBox.split(/\s+/);
                if (values.length === 4) {
                    return {
                        width: parseInt(values[2]),
                        height: parseInt(values[3])
                    };
                }
            }
            return null;
        } catch {
            return null;
        }
    }
}

export default ImageConverter;
