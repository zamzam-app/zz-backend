import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VisualiseCakeDto } from './dto/visualise-cake.dto';

// Nano Banana 2 — best quality + speed balance for image generation
// Switch to 'gemini-3-pro-image-preview' for Nano Banana Pro (highest quality, slower)
const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Only fetch base images from our own Cloudinary account host, over HTTPS. */
const ALLOWED_IMAGE_HOSTS = ['res.cloudinary.com'];
const MAX_BASE_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const BASE_IMAGE_TIMEOUT_MS = 10_000;

interface GeminiPart {
  inlineData?: { data: string; mimeType: string };
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message?: string };
}

@Injectable()
export class CakeVisualiserService {
  private readonly logger = new Logger(CakeVisualiserService.name);
  private readonly PLACEHOLDER_IMAGE =
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800';

  constructor(private readonly configService: ConfigService) {}

  async visualiseCake(dto: VisualiseCakeDto) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    // Feature disabled — no API key present
    if (!apiKey) {
      return {
        success: false,
        message: 'Coming Soon',
        placeholderImage: this.PLACEHOLDER_IMAGE,
      };
    }

    const prompt = this.buildPrompt(dto);

    // Build parts — image first (if provided), text last
    const parts: object[] = [];

    if (dto.baseImage) {
      // Reject before any request is made: the URL is caller-controlled.
      this.assertAllowedImageUrl(dto.baseImage);
      try {
        const { base64, mimeType } = await this.fetchImageAsBase64(
          dto.baseImage,
        );
        parts.push({ inlineData: { mimeType, data: base64 } });
      } catch (err) {
        this.logger.warn(`Failed to fetch base image: ${dto.baseImage}`, err);
        // Continue without base image rather than failing the whole request
      }
    }

    parts.push({ text: prompt });

    // Call Gemini directly — auth via x-goog-api-key header (no service account needed)
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });
    } catch (err) {
      this.logger.error('Network error calling Gemini API', err);
      throw new InternalServerErrorException(
        'Failed to reach image generation service',
      );
    }

    const geminiData = (await geminiResponse.json()) as GeminiResponse;

    if (!geminiResponse.ok) {
      this.logger.error('Gemini API error response', geminiData);
      throw new InternalServerErrorException(
        geminiData?.error?.message ||
          'Image generation service returned an error',
      );
    }

    const responseParts = geminiData?.candidates?.[0]?.content?.parts ?? [];

    const imagePart = responseParts.find((p) => p.inlineData);
    const textPart = responseParts.find((p) => p.text);

    if (imagePart?.inlineData) {
      return {
        success: true,
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
        prompt: textPart?.text ?? '',
      };
    }

    // Gemini returned no image — return text description as fallback
    this.logger.warn('Gemini returned no image part, falling back to text');
    return {
      success: true,
      imageBase64: null,
      prompt: textPart?.text ?? 'No description generated',
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildPrompt(dto: VisualiseCakeDto): string {
    return `
      You are an expert cake designer for ZamZam (Nano Banana).
      Generate a photorealistic, stunning image of a custom cake with these details:
      - Text on cake: ${dto.text ?? 'Keep original'}
      - Shape: ${dto.shape ?? 'Keep original'}
      - Flavor: ${dto.flavor ?? 'Keep original'}
      - Extra decorations / requests: ${dto.extraRequests ?? 'None'}
      Preserve all ZamZam branding elements (e.g. branding chips, logo placement).
      Only change what the customer explicitly requested. Make it look professional and appetizing.
    `.trim();
  }

  private assertAllowedImageUrl(imageUrl: string): void {
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      throw new BadRequestException('baseImage must be a valid URL');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !ALLOWED_IMAGE_HOSTS.includes(url.hostname)
    ) {
      throw new BadRequestException('baseImage host is not allowed');
    }
  }

  private async fetchImageAsBase64(
    imageUrl: string,
  ): Promise<{ base64: string; mimeType: string }> {
    // redirect: 'error' stops an allowed host from bouncing us to an internal one.
    const res = await fetch(imageUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(BASE_IMAGE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`);

    const mimeType = res.headers.get('content-type') || '';
    if (!mimeType.startsWith('image/')) {
      throw new Error('Base image is not an image');
    }
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BASE_IMAGE_BYTES) {
      throw new Error('Base image is too large');
    }

    // Read as a stream so the cap holds even without a Content-Length header.
    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Empty image response');
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BASE_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error('Base image is too large');
      }
      chunks.push(value);
    }
    const base64 = Buffer.concat(chunks).toString('base64');
    return { base64, mimeType };
  }
}
