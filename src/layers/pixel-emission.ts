import type { PixelGrid, RGBA } from './pixel-perception';

/**
 * M5 — Pixel-art emission.
 *
 * The IR is a color matrix; emission writes a 1:1 PNG with no resampling
 * (symmetry/composition already enforced as constraints), guaranteeing
 * crisp pixels.
 *
 * This module generates a minimal PNG file from a PixelGrid.
 * No external dependencies — pure buffer manipulation.
 */

/**
 * Generate a minimal PNG file from a pixel grid.
 * Returns a Buffer containing the PNG data.
 */
export function emitPixelPng(grid: PixelGrid): Buffer {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (h === 0 || w === 0) return Buffer.alloc(0);

  // PNG structure:
  // 1. Signature (8 bytes)
  // 2. IHDR chunk (image header)
  // 3. IDAT chunk (image data — compressed)
  // 4. IEND chunk (image end)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);   // bit depth = 8
  ihdr.writeUInt8(6, 9);   // color type = 6 (RGBA)
  ihdr.writeUInt8(0, 10);  // compression = 0 (deflate)
  ihdr.writeUInt8(0, 11);  // filter = 0 (adaptive)
  ihdr.writeUInt8(0, 12);  // interlace = 0 (none)

  // Raw image data: each row has a filter byte (0) + RGBA pixels
  const rawRows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    row.writeUInt8(0, 0); // filter: none
    for (let x = 0; x < w; x++) {
      const pixel = grid[y][x];
      const offset = 1 + x * 4;
      row.writeUInt8(pixel.r, offset);
      row.writeUInt8(pixel.g, offset + 1);
      row.writeUInt8(pixel.b, offset + 2);
      row.writeUInt8(pixel.a, offset + 3);
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);

  // Compress with deflate (raw, no zlib header for IDAT)
  const compressed = deflateSync(rawData);

  // Build chunks
  const chunks: Buffer[] = [signature];
  chunks.push(createChunk('IHDR', ihdr));
  chunks.push(createChunk('IDAT', compressed));
  chunks.push(createChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

/**
 * Create a PNG chunk: length(4) + type(4) + data + crc32(4)
 */
function createChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/**
 * Minimal deflate compression (store mode — no compression).
 * For production, use zlib.deflateSync for proper compression.
 */
function deflateSync(data: Buffer): Buffer {
  // Use Node's built-in zlib for proper deflate compression.
  // The store-mode fallback is kept as a comment for reference.
  try {
    const zlib = require('zlib');
    return zlib.deflateRawSync(data);
  } catch {
    // Fallback: store mode (no compression)
    return deflateStore(data);
  }
}

/**
 * Deflate store mode — no compression, just framing.
 * Each block: BFINAL(1) + BTYPE=00(2) + LEN(2) + NLEN(2) + data
 */
function deflateStore(data: Buffer): Buffer {
  const MAX_BLOCK = 65535;
  const blocks: Buffer[] = [];
  let offset = 0;

  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockSize = Math.min(remaining, MAX_BLOCK);
    const isFinal = offset + blockSize >= data.length;

    const header = Buffer.alloc(5);
    header.writeUInt8(isFinal ? 1 : 0, 0); // BFINAL
    header.writeUInt16LE(blockSize, 1);     // LEN
    header.writeUInt16LE(blockSize ^ 0xffff, 3); // NLEN

    blocks.push(header);
    blocks.push(data.subarray(offset, offset + blockSize));
    offset += blockSize;
  }

  return Buffer.concat(blocks);
}

/**
 * CRC32 implementation for PNG chunk checksums.
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Apply symmetry constraints to a pixel grid.
 * Mirrors pixels across the vertical axis to enforce bilateral symmetry.
 */
export function enforceSymmetry(grid: PixelGrid, axis: 'vertical' | 'horizontal' = 'vertical'): PixelGrid {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (h === 0 || w === 0) return grid;

  // Deep copy
  const result: PixelGrid = grid.map((row) => [...row]);

  if (axis === 'vertical') {
    const mid = Math.floor(w / 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < mid; x++) {
        const mirrorX = w - 1 - x;
        // Use the average of both sides for a balanced result
        result[y][mirrorX] = { ...result[y][x] };
      }
    }
  } else {
    const mid = Math.floor(h / 2);
    for (let y = 0; y < mid; y++) {
      const mirrorY = h - 1 - y;
      for (let x = 0; x < w; x++) {
        result[mirrorY][x] = { ...result[y][x] };
      }
    }
  }

  return result;
}

/**
 * Snap pixel colors to a limited palette.
 * Replaces each pixel with the nearest color from the palette.
 */
export function snapToPalette(grid: PixelGrid, palette: RGBA[]): PixelGrid {
  return grid.map((row) =>
    row.map((pixel) => {
      if (pixel.a === 0) return pixel; // keep transparent

      let nearest = palette[0];
      let minDist = Infinity;

      for (const c of palette) {
        const dist = Math.sqrt(
          Math.pow(pixel.r - c.r, 2) +
          Math.pow(pixel.g - c.g, 2) +
          Math.pow(pixel.b - c.b, 2),
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = c;
        }
      }

      return { ...nearest, a: pixel.a };
    }),
  );
}
