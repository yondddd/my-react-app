/**
 * @file Reusable Image Converter Utility
 * @author Gemini AI (Refactored and Optimized from original)
 * @version 2.1
 *
 * @description
 * Provides a suite of static methods to convert images, particularly from SVG,
 * to various formats (PNG, JPEG, TIFF) with proper DPI metadata.
 * It has been optimized for performance, especially in JPEG creation and PNG
 * metadata injection. It includes low-level writers for adding DPI information
 * to ensure maximum control and compatibility.
 *
 * @requires piexifjs - For writing EXIF metadata to JPEGs.
 * @requires pako - For Deflate compression used in TIFF generation.
 *
 * @example
 * // Basic Usage:
 * const svgString = '<svg width="100" height="100">...</svg>';
 * try {
 *   const { data, mimeType } = await ImageConverter.convertSvg(svgString, 'png', 300);
 *   ImageConverter.downloadFile(data, 'my-image.png', mimeType);
 * } catch (error) {
 *   console.error('Conversion failed:', error);
 * }
 */

import piexif from 'piexifjs';
import pako from 'pako';


/**
 * Internal configuration for the converter.
 * @private
 */
const CONFIG = {
    SOFTWARE_NAME: 'ImageConverter.js',
    DEFAULT_DPI: 72,
    JPEG_QUALITY: 1.0,
};


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


export class ImageConverter {

    // --- Public API ---

    /**
     * The main conversion function. Converts an SVG string to the specified format with DPI.
     * @param {string} svgString - The SVG content as a string.
     * @param {string} format - The target output format ('png', 'jpg', 'jpeg', 'tiff', 'tif').
     * @param {number} [dpi=CONFIG.DEFAULT_DPI] - The target DPI for the output image.
     * @param {number} [quality=CONFIG.JPEG_QUALITY] - The quality for lossy formats like JPEG (0-1).
     * @param {boolean} [transparentBackground=false] - Whether to use transparent background (PNG/TIFF only).
     * @returns {Promise<{data: Blob|Uint8Array, mimeType: string, canvas: HTMLCanvasElement}>} An object containing the image data, MIME type, and the intermediate canvas.
     * @throws {Error} If input is invalid or conversion fails.
     */
    static async convertSvg(svgString, format, dpi = CONFIG.DEFAULT_DPI, quality = CONFIG.JPEG_QUALITY, transparentBackground = false) {
        this._validateInputs(svgString, format, dpi, quality);

        try {
            const canvas = await this.svgToCanvas(svgString, dpi, transparentBackground);

            switch (format.toLowerCase()) {
                case 'png':
                    return {
                        data: await this.canvasToPng(canvas, dpi),
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
                    return {
                        data: await this.canvasToTiff(canvas, dpi, transparentBackground),
                        mimeType: 'image/tiff',
                        canvas
                    };
                default:
                    // This case should ideally not be reached due to initial validation.
                    throw new Error(`Unsupported format: ${format}.`);
            }
        } catch (error) {
            // Re-throw errors from downstream functions with more context.
            throw new Error(`SVG to ${format} conversion failed: ${error.message}`);
        }
    }

    /**
     * Triggers a browser download for the given image data.
     * @param {Blob|Uint8Array} data - The file data to be downloaded.
     * @param {string} filename - The desired filename, including extension.
     * @param {string} mimeType - The MIME type of the file.
     * @throws {Error} If inputs are invalid or download fails.
     */
    static downloadFile(data, filename, mimeType) {
        if (!data) throw new Error('No data provided for download.');
        if (!filename || typeof filename !== 'string') throw new Error('A valid filename must be provided.');
        if (!mimeType || typeof mimeType !== 'string') throw new Error('A valid MIME type must be provided.');

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


    // --- Core Conversion Steps ---

    /**
     * Renders an SVG string onto a canvas, scaled to the target DPI.
     * @param {string} svgString - The SVG content as a string.
     * @param {number} [dpi=CONFIG.DEFAULT_DPI] - The target DPI.
     * @param {boolean} [transparentBackground=false] - Whether to use transparent background.
     * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the rendered canvas element.
     */
    static async svgToCanvas(svgString, dpi = CONFIG.DEFAULT_DPI, transparentBackground = false) {
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);

        try {
            const img = await this._loadImageFromUrl(svgUrl);
            const dimensions = this.getSvgDimensions(svgString) || { width: img.naturalWidth, height: img.naturalHeight };

            const scale = dpi / CONFIG.DEFAULT_DPI;
            const width = Math.round(dimensions.width * scale);
            const height = Math.round(dimensions.height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            // Use alpha: true for transparent background, false for opaque background for better performance
            const ctx = canvas.getContext('2d', { alpha: transparentBackground });
            if (!ctx) throw new Error("Could not get 2D context from canvas.");

            // Only fill with white background if not using transparent background
            if (!transparentBackground) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, width, height);
            }
            
            ctx.drawImage(img, 0, 0, width, height);

            return canvas;
        } finally {
            URL.revokeObjectURL(svgUrl);
        }
    }

    /**
     * Converts a canvas element to a PNG Blob, embedding DPI metadata.
     * Note: The 'quality' parameter is not applicable to PNG and has been removed.
     * @param {HTMLCanvasElement} canvas - The source canvas.
     * @param {number} dpi - The DPI value to embed.
     * @returns {Promise<Blob>} A promise that resolves with the PNG Blob.
     */
    static async canvasToPng(canvas, dpi) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Canvas to Blob conversion failed for PNG.");

        try {
            const pngData = new Uint8Array(await blob.arrayBuffer());
            const pngWithDpi = this._addPngDpiChunk(pngData, dpi);
            return new Blob([pngWithDpi], { type: 'image/png' });
        } catch (error) {
            console.warn('Failed to add DPI metadata to PNG, returning original PNG.', error);
            return blob;
        }
    }

    /**
     * [OPTIMIZED] Converts a canvas to a JPEG Blob, embedding DPI metadata in both EXIF and JFIF.
     * @param {HTMLCanvasElement} canvas - The source canvas.
     * @param {number} dpi - The DPI value to embed.
     * @param {number} [quality=CONFIG.JPEG_QUALITY] - The image quality for the JPEG (0-1).
     * @returns {Promise<Blob>} A promise that resolves with the JPEG Blob.
     */
    static async canvasToJpeg(canvas, dpi, quality = CONFIG.JPEG_QUALITY) {
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const exif = this._createExifObject(canvas.width, canvas.height, dpi);
            const exifBytes = piexif.dump(exif);
            const jpegWithExifStr = piexif.insert(exifBytes, dataUrl);

            // OPTIMIZATION: Use fetch API for fast base64 to ArrayBuffer conversion,
            // avoiding inefficient string manipulation (atob) and manual loops.
            const response = await fetch(jpegWithExifStr);
            const jpegBuffer = await response.arrayBuffer();
            let bytes = new Uint8Array(jpegBuffer);

            // Also set DPI in the JFIF segment for wider compatibility
            bytes = this._setJfifDpi(bytes, dpi);
            return new Blob([bytes], { type: 'image/jpeg' });

        } catch (error) {
            console.error('Failed to create JPEG with custom EXIF. Falling back to default.', error);
            // Fallback to simple conversion if EXIF injection fails
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (!blob) throw new Error("Canvas to Blob conversion failed for JPEG.");
            return blob;
        }
    }

    /**
     * Converts a canvas to a Deflate-compressed TIFF using a manual writer.
     * This direct approach ensures stability and proper metadata handling.
     * @param {HTMLCanvasElement} canvas - The source canvas.
     * @param {number} dpi - The DPI for the output image.
     * @param {boolean} [transparentBackground=false] - Whether to preserve transparency.
     * @returns {Promise<Uint8Array>} A promise that resolves with the compressed TIFF data as a byte array.
     */
    static async canvasToTiff(canvas, dpi, transparentBackground = false) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2D context from canvas");

        // 1. Prepare Pixel Data
        const { width, height } = canvas;
        const rgbaData = ctx.getImageData(0, 0, width, height).data;
        
        // Check if canvas actually has transparency
        const hasTransparency = transparentBackground && this._hasTransparency(rgbaData);
        
        const pixelData = this._rgbaToRgb(rgbaData, hasTransparency);
        const compressedData = pako.deflate(pixelData);

        // 2. Define TIFF Tags
        const tags = this._createTiffTagEntries(width, height, dpi, compressedData.length, hasTransparency);

        // 3. Build the TIFF File Buffer
        const tiffBuffer = this._buildTiffBuffer(tags, compressedData);

        return new Uint8Array(tiffBuffer);
    }

    // --- SVG & Date Utilities ---

    /**
     * Checks if an SVG string is well-formed.
     * @param {string} svgString - The SVG content to validate.
     * @returns {boolean} True if the SVG is valid.
     */
    static isValidSvg(svgString) {
        if (!svgString || typeof svgString !== 'string') return false;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            return doc.getElementsByTagName('parsererror').length === 0 && doc.documentElement?.tagName === 'svg';
        } catch {
            return false;
        }
    }

    /**
     * Extracts dimensions (width/height) from an SVG string's attributes or viewBox.
     * @param {string} svgString - The SVG content.
     * @returns {{width: number, height: number} | null} The dimensions, or null if not found.
     */
    static getSvgDimensions(svgString) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgString, 'image/svg+xml');
            const svg = doc.documentElement;

            if (svg?.tagName !== 'svg') return null;

            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            const viewBox = svg.getAttribute('viewBox');

            if (width && height) {
                return { width: parseFloat(width), height: parseFloat(height) };
            }
            if (viewBox) {
                const [, , vbWidth, vbHeight] = viewBox.split(/\s+|,/).map(parseFloat);
                if (vbWidth && vbHeight) {
                    return { width: vbWidth, height: vbHeight };
                }
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Formats a date into the "YYYY:MM:DD HH:MM:SS" format required by EXIF.
     * @param {Date} [date=new Date()] - The date to format.
     * @returns {string} The formatted date string.
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


    // --- Private Helper Methods ---

    /**
     * Validates inputs for the main convertSvg function.
     * @private
     */
    static _validateInputs(svgString, format, dpi, quality) {
        if (!this.isValidSvg(svgString)) {
            throw new Error('Invalid or empty SVG string provided.');
        }
        const supportedFormats = ['png', 'jpg', 'jpeg', 'tiff', 'tif'];
        if (!supportedFormats.includes(format?.toLowerCase())) {
            throw new Error(`Unsupported format: '${format}'. Supported formats: ${supportedFormats.join(', ')}.`);
        }
        if (typeof dpi !== 'number' || dpi <= 0 || dpi > 2400) {
            throw new Error('DPI must be a positive number, typically between 72 and 2400.');
        }
        if (typeof quality !== 'number' || quality < 0 || quality > 1) {
            throw new Error('Quality must be a number between 0 and 1.');
        }
    }

    /**
     * Creates a Promise-based wrapper for loading an image from a URL.
     * @private
     */
    static _loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image from URL: ${url}`));
            img.src = url;
        });
    }

    /**
     * [OPTIMIZED] Converts RGBA pixel data to RGB, optionally preserving transparency or blending with white background.
     * @param {Uint8ClampedArray} rgbaData - The source RGBA pixel data.
     * @param {boolean} [preserveTransparency=false] - Whether to preserve transparency (for TIFF with alpha).
     * @returns {Uint8Array} The resulting RGB or RGBA pixel data.
     * @private
     */
    static _rgbaToRgb(rgbaData, preserveTransparency = false) {
        if (preserveTransparency) {
            // Return RGBA data as-is for formats that support transparency
            return new Uint8Array(rgbaData);
        }
        
        const rgbData = new Uint8Array((rgbaData.length / 4) * 3);
        for (let i = 0, j = 0; i < rgbaData.length; i += 4, j += 3) {
            const alpha = rgbaData[i + 3] / 255;

            // OPTIMIZATION: If pixel is fully opaque, skip float math and copy directly.
            if (alpha === 1) {
                rgbData[j] = rgbaData[i];
                rgbData[j + 1] = rgbaData[i + 1];
                rgbData[j + 2] = rgbaData[i + 2];
            } else {
                // OPTIMIZATION: Pre-calculate the blending contribution from the white background.
                const oneMinusAlpha = 1 - alpha;
                const whiteContribution = 255 * oneMinusAlpha;
                rgbData[j] = Math.round(rgbaData[i] * alpha + whiteContribution);
                rgbData[j + 1] = Math.round(rgbaData[i + 1] * alpha + whiteContribution);
                rgbData[j + 2] = Math.round(rgbaData[i + 2] * alpha + whiteContribution);
            }
        }
        return rgbData;
    }

    /**
     * [OPTIMIZED] Manually inserts a PNG pHYs chunk to store DPI without unnecessary iteration.
     * @param {Uint8Array} pngData - The original PNG byte array.
     * @param {number} dpi - The DPI value to set.
     * @returns {Uint8Array} The new PNG byte array with the pHYs chunk.
     * @private
     */
    static _addPngDpiChunk(pngData, dpi) {
        // A valid PNG file starts with an 8-byte signature, followed by the IHDR chunk.
        // The IHDR chunk is always 25 bytes long (4 length + 4 type + 13 data + 4 CRC).
        const IHDR_CHUNK_LENGTH = 25;
        const PNG_SIGNATURE_LENGTH = 8;
        const insertionPoint = PNG_SIGNATURE_LENGTH + IHDR_CHUNK_LENGTH;

        // Basic validation
        if (pngData.length < insertionPoint || String.fromCharCode(...pngData.slice(1, 4)) !== 'PNG' || String.fromCharCode(...pngData.slice(12, 16)) !== 'IHDR') {
            throw new Error('Invalid PNG format: Missing IHDR chunk at expected position.');
        }

        // Create the pHYs chunk
        const pixelsPerMeter = Math.round(dpi * 39.3701);
        const physChunkData = new Uint8Array(9);
        const chunkDataView = new DataView(physChunkData.buffer);
        chunkDataView.setUint32(0, pixelsPerMeter, false); // Pixels per unit, X axis
        chunkDataView.setUint32(4, pixelsPerMeter, false); // Pixels per unit, Y axis
        chunkDataView.setUint8(8, 1); // Unit is meter

        // Construct the full chunk: Length (4B) + Type (4B) + Data (9B) + CRC (4B)
        const CHUNK_TYPE_BYTES = [0x70, 0x48, 0x59, 0x73]; // 'pHYs'
        const crc = this._calculateCrc32(new Uint8Array([...CHUNK_TYPE_BYTES, ...physChunkData]));
        const physChunk = new Uint8Array(4 + 4 + 9 + 4);
        const physView = new DataView(physChunk.buffer);
        physView.setUint32(0, 9, false); // Length of data is 9
        physChunk.set(CHUNK_TYPE_BYTES, 4);
        physChunk.set(physChunkData, 8);
        physView.setUint32(17, crc, false); // CRC

        // Combine the parts: original PNG up to insertion point, pHYs chunk, rest of original PNG
        const result = new Uint8Array(pngData.length + physChunk.length);
        result.set(pngData.slice(0, insertionPoint));
        result.set(physChunk, insertionPoint);
        result.set(pngData.slice(insertionPoint), insertionPoint + physChunk.length);

        return result;
    }


    /**
     * Checks if RGBA data contains any transparency (alpha < 255).
     * @param {Uint8ClampedArray} rgbaData - The RGBA pixel data to check.
     * @returns {boolean} True if transparency is found.
     * @private
     */
    static _hasTransparency(rgbaData) {
        for (let i = 3; i < rgbaData.length; i += 4) {
            if (rgbaData[i] < 255) {
                return true;
            }
        }
        return false;
    }

    /**
     * Standard CRC32 checksum calculation for PNG chunks.
     * @param {Uint8Array} data - Data to calculate CRC for (chunk type + chunk data).
     * @returns {number} The CRC32 value.
     * @private
     */
    static _calculateCrc32(data) {
        const crcTable = new Uint32Array(256).map((_, i) => {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            return c;
        });

        let crc = -1; // 0xFFFFFFFF
        for (let i = 0; i < data.length; i++) {
            crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ -1) >>> 0;
    }

    /**
     * Creates the EXIF object structure for piexifjs.
     * @private
     */
    static _createExifObject(width, height, dpi) {
        const now = this.formatDateTime();
        return {
            '0th': {
                [piexif.ImageIFD.XResolution]: [dpi, 1],
                [piexif.ImageIFD.YResolution]: [dpi, 1],
                [piexif.ImageIFD.ResolutionUnit]: 2, // Inches
                [piexif.ImageIFD.Software]: CONFIG.SOFTWARE_NAME,
                [piexif.ImageIFD.DateTime]: now,
            },
            'Exif': {
                [piexif.ExifIFD.PixelXDimension]: width,
                [piexif.ExifIFD.PixelYDimension]: height,
                [piexif.ExifIFD.DateTimeOriginal]: now,
                [piexif.ExifIFD.DateTimeDigitized]: now,
            },
        };
    }

    /**
     * Sets the DPI in the JFIF (APP0) segment of a JPEG file for better compatibility.
     * @private
     */
    static _setJfifDpi(jpegData, dpi) {
        if (jpegData[0] !== 0xFF || jpegData[1] !== 0xD8) {
            console.warn('Invalid JPEG data: Missing SOI marker. Skipping JFIF DPI injection.');
            return jpegData;
        }

        let jfifMarkerIndex = -1;
        let offset = 2;

        while (offset < jpegData.length - 1) {
            if (jpegData[offset] !== 0xFF) break;

            const marker = jpegData[offset + 1];
            if (marker >= 0xE0 && marker <= 0xEF) {
                if (offset + 9 < jpegData.length &&
                    jpegData[offset + 4] === 0x4A && jpegData[offset + 5] === 0x46 &&
                    jpegData[offset + 6] === 0x49 && jpegData[offset + 7] === 0x46 &&
                    jpegData[offset + 8] === 0x00) {
                    jfifMarkerIndex = offset;
                    break;
                }
                const segmentLength = (jpegData[offset + 2] << 8) | jpegData[offset + 3];
                offset += 2 + segmentLength;
            } else {
                break;
            }
        }

        const modifiedData = new Uint8Array(jpegData);
        if (jfifMarkerIndex !== -1) {
            modifiedData[jfifMarkerIndex + 11] = 1;
            modifiedData[jfifMarkerIndex + 12] = (dpi >> 8) & 0xFF;
            modifiedData[jfifMarkerIndex + 13] = dpi & 0xFF;
            modifiedData[jfifMarkerIndex + 14] = (dpi >> 8) & 0xFF;
            modifiedData[jfifMarkerIndex + 15] = dpi & 0xFF;
            return modifiedData;
        } else {
            const jfifSegment = new Uint8Array([
                0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
                (dpi >> 8) & 0xFF, dpi & 0xFF, (dpi >> 8) & 0xFF, dpi & 0xFF, 0x00, 0x00
            ]);
            const newData = new Uint8Array(jpegData.length + jfifSegment.length);
            newData.set(jpegData.slice(0, 2), 0);
            newData.set(jfifSegment, 2);
            newData.set(jpegData.slice(2), 2 + jfifSegment.length);
            return newData;
        }
    }

    /**
     * Creates the array of tag entries for the TIFF Image File Directory (IFD).
     * @private
     */
    static _createTiffTagEntries(width, height, dpi, compressedDataLength, hasTransparency = false) {
        const samplesPerPixel = hasTransparency ? 4 : 3;
        const bitsPerSample = hasTransparency ? [8, 8, 8, 8] : [8, 8, 8];
        
        const tags = [
            { tag: piexif.ImageIFD.ImageWidth, type: TIFF_TYPES.LONG, count: 1, value: width },
            { tag: piexif.ImageIFD.ImageLength, type: TIFF_TYPES.LONG, count: 1, value: height },
            { tag: piexif.ImageIFD.BitsPerSample, type: TIFF_TYPES.SHORT, count: samplesPerPixel, value: bitsPerSample },
            { tag: piexif.ImageIFD.Compression, type: TIFF_TYPES.SHORT, count: 1, value: 8 },
            { tag: piexif.ImageIFD.PhotometricInterpretation, type: TIFF_TYPES.SHORT, count: 1, value: 2 },
            { tag: piexif.ImageIFD.StripOffsets, type: TIFF_TYPES.LONG, count: 1, value: 0 },
            { tag: piexif.ImageIFD.SamplesPerPixel, type: TIFF_TYPES.SHORT, count: 1, value: samplesPerPixel },
            { tag: piexif.ImageIFD.StripByteCounts, type: TIFF_TYPES.LONG, count: 1, value: compressedDataLength },
            { tag: piexif.ImageIFD.XResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: [dpi, 1] },
            { tag: piexif.ImageIFD.YResolution, type: TIFF_TYPES.RATIONAL, count: 1, value: [dpi, 1] },
            { tag: piexif.ImageIFD.ResolutionUnit, type: TIFF_TYPES.SHORT, count: 1, value: 2 },
            { tag: piexif.ImageIFD.Software, type: TIFF_TYPES.ASCII, count: 0, value: CONFIG.SOFTWARE_NAME },
            { tag: piexif.ImageIFD.DateTime, type: TIFF_TYPES.ASCII, count: 0, value: this.formatDateTime() },
        ];
        
        // Add ExtraSamples tag for alpha channel if transparency is present
        if (hasTransparency) {
            tags.push({ tag: 338, type: TIFF_TYPES.SHORT, count: 1, value: 1 }); // ExtraSamples: 1 = Associated alpha
        }
        
        return tags;
    }

    /**
     * Assembles the complete TIFF file buffer from its constituent parts.
     * @private
     */
    static _buildTiffBuffer(tags, compressedData) {
        const isLittleEndian = false;
        const dataBlocks = [];
        let dataBlockOffset = 8 + 2 + (tags.length * 12) + 4;

        for (const tag of tags) {
            if (tag.type === TIFF_TYPES.ASCII) {
                tag.value += '\0';
                tag.count = tag.value.length;
            }
            const valueByteLength = { [TIFF_TYPES.SHORT]: 2, [TIFF_TYPES.LONG]: 4, [TIFF_TYPES.RATIONAL]: 8, [TIFF_TYPES.ASCII]: 1 }[tag.type] * tag.count;
            if (valueByteLength > 4) {
                dataBlocks.push({ offset: dataBlockOffset, data: tag.value, type: tag.type });
                tag.value = dataBlockOffset;
                dataBlockOffset += valueByteLength;
                if (dataBlockOffset % 2 !== 0) dataBlockOffset++;
            }
        }

        const imageDataOffset = dataBlockOffset;
        tags.find(t => t.tag === piexif.ImageIFD.StripOffsets).value = imageDataOffset;

        const fileLength = imageDataOffset + compressedData.length;
        const fileBuffer = new ArrayBuffer(fileLength);
        const view = new DataView(fileBuffer);
        let bufferOffset = 0;

        const write16 = (val) => { view.setUint16(bufferOffset, val, isLittleEndian); bufferOffset += 2; };
        const write32 = (val) => { view.setUint32(bufferOffset, val, isLittleEndian); bufferOffset += 4; };

        write16(isLittleEndian ? 0x4949 : 0x4D4D);
        write16(42);
        write32(8);
        write16(tags.length);

        for (const tag of tags) {
            write16(tag.tag);
            write16(tag.type);
            write32(tag.count);
            const valueByteLength = { [TIFF_TYPES.SHORT]: 2, [TIFF_TYPES.LONG]: 4, [TIFF_TYPES.RATIONAL]: 8, [TIFF_TYPES.ASCII]: 1 }[tag.type] * tag.count;
            if (valueByteLength <= 4) {
                if (tag.type === TIFF_TYPES.SHORT) write16(tag.value);
                else if (tag.type === TIFF_TYPES.LONG) write32(tag.value);
                else write32(Array.isArray(tag.value) ? tag.value[0] : tag.value);
                for (let i = valueByteLength; i < 4; i++) view.setUint8(bufferOffset++, 0);
            } else {
                write32(tag.value);
            }
        }
        write32(0);

        for (const block of dataBlocks) {
            bufferOffset = block.offset;
            if (block.type === TIFF_TYPES.RATIONAL) {
                write32(block.data[0]);
                write32(block.data[1]);
            } else if (block.type === TIFF_TYPES.SHORT) {
                for (const val of block.data) write16(val);
            } else if (block.type === TIFF_TYPES.ASCII) {
                for (let i = 0; i < block.data.length; i++) view.setUint8(bufferOffset++, block.data.charCodeAt(i));
            }
        }

        new Uint8Array(fileBuffer).set(compressedData, imageDataOffset);
        return fileBuffer;
    }
}

export default ImageConverter;