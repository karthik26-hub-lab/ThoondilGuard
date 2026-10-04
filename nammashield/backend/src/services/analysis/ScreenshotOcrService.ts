import Tesseract from 'tesseract.js';
import { env } from '../../config/env.js';
import type { OcrMetadata } from '../../types/analysis.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_IMAGE_DIMENSION = 10_000;
const MAX_OCR_TEXT_CHARACTERS = 50_000;
const LOW_CONFIDENCE_THRESHOLD = 55;
const TANGLISH_MARKERS = new Set([
  'aagum', 'anuppunga', 'illana', 'innaiku', 'inniku', 'irukku', 'ippove',
  'pannunga', 'pannitu', 'ungal', 'unga', 'udane', 'veetula', 'panna', 'kooda',
]);

export class ScreenshotInputError extends Error {
  constructor(readonly code: 'invalid_image' | 'unsupported_type' | 'image_too_large' | 'image_dimensions') {
    super('Screenshot input is invalid or unsupported.');
    this.name = 'ScreenshotInputError';
  }
}

interface ImageInfo {
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

function imageInfo(bytes: Buffer): ImageInfo | null {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return {
      mimeType: 'image/png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 7) return null;
      return {
        mimeType: 'image/jpeg',
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function validateImage(image: Uint8Array, declaredMimeType?: string): Buffer {
  if (!(image instanceof Uint8Array) || image.byteLength < 16) throw new ScreenshotInputError('invalid_image');
  if (image.byteLength > MAX_IMAGE_BYTES) throw new ScreenshotInputError('image_too_large');
  const bytes = Buffer.from(image);
  const info = imageInfo(bytes);
  if (!info) throw new ScreenshotInputError('unsupported_type');
  if (declaredMimeType && declaredMimeType.toLowerCase() !== info.mimeType) {
    throw new ScreenshotInputError('unsupported_type');
  }
  if (info.width < 1 || info.height < 1 || info.width > MAX_IMAGE_DIMENSION
    || info.height > MAX_IMAGE_DIMENSION || info.width * info.height > MAX_IMAGE_PIXELS) {
    throw new ScreenshotInputError('image_dimensions');
  }
  return bytes;
}

function languageAndScript(text: string): Pick<OcrMetadata, 'language' | 'script'> {
  const hasTamil = /[\u0B80-\u0BFF]/u.test(text);
  const hasLatin = /[A-Za-z]/u.test(text);
  if (hasTamil && hasLatin) return { language: 'mixed', script: 'Mixed' };
  if (hasTamil) return { language: 'ta', script: 'Tamil' };
  if (!hasLatin) return { language: 'unknown', script: 'Unknown' };
  const words = new Set(text.toLowerCase().match(/[a-z]+/gu) ?? []);
  const tanglishMarkers = [...words].filter((word) => TANGLISH_MARKERS.has(word)).length;
  if (tanglishMarkers >= 2) return { language: 'ta-Latn', script: 'Latin' };
  return { language: 'en', script: 'Latin' };
}

export class ScreenshotOcrService {
  private workerPromise: Promise<Pick<Tesseract.Worker, 'recognize' | 'terminate'>> | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly createWorker: () => Promise<Pick<Tesseract.Worker, 'recognize' | 'terminate'>> = () =>
      Tesseract.createWorker(
        'eng+tam',
        1,
        {
          logger: () => undefined,
          errorHandler: () => undefined,
          ...(env.tesseractLangPath ? { langPath: env.tesseractLangPath } : {}),
        },
      ),
  ) {}

  async extract(image: Uint8Array, declaredMimeType?: string): Promise<OcrMetadata> {
    const bytes = validateImage(image, declaredMimeType);
    let release: (() => void) | undefined;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    let activeWorker: Pick<Tesseract.Worker, 'recognize' | 'terminate'> | undefined;

    try {
      activeWorker = await (this.workerPromise ??= this.createWorker());
      const { data } = await activeWorker.recognize(bytes);
      const unboundedText = data.text.trim();
      const extractedText = unboundedText.slice(0, MAX_OCR_TEXT_CHARACTERS);
      const truncated = unboundedText.length > MAX_OCR_TEXT_CHARACTERS;
      const meanConfidence = Number.isFinite(data.confidence)
        ? Math.max(0, Math.min(100, data.confidence))
        : null;
      const lowConfidence = !extractedText || meanConfidence === null || meanConfidence < LOW_CONFIDENCE_THRESHOLD || truncated;
      return {
        status: lowConfidence ? 'low_confidence' : 'complete',
        extractedText,
        meanConfidence,
        ...languageAndScript(extractedText),
        needsReview: lowConfidence,
        ...(lowConfidence ? { warning: truncated
          ? 'OCR output was truncated to a safe size and may be incomplete; review it before relying on the analysis.'
          : 'OCR text may be incomplete or inaccurate; review it before relying on the analysis.' } : {}),
      };
    } catch {
      this.workerPromise = undefined;
      if (activeWorker) await activeWorker.terminate().catch(() => undefined);
      return {
        status: 'failed',
        extractedText: '',
        meanConfidence: null,
        language: 'unknown',
        script: 'Unknown',
        needsReview: true,
        warning: 'Screenshot text could not be extracted; the analysis needs manual verification.',
      };
    } finally {
      release?.();
    }
  }

  async close(): Promise<void> {
    await this.queue;
    if (!this.workerPromise) return;
    const worker = await this.workerPromise.catch(() => undefined);
    this.workerPromise = undefined;
    if (worker) await worker.terminate().catch(() => undefined);
  }
}
