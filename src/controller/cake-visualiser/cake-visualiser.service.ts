import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VisualiseCakeDto } from './dto/visualise-cake.dto';

interface GeminiErrorResponse {
  error?: { message?: string };
}

@Injectable()
export class CakeVisualiserService {
  private readonly logger = new Logger(CakeVisualiserService.name);
  private readonly GEMINI_MODEL = 'gemini-2.5-flash-image';
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
    const parts: object[] = [];

    // If a base image URL is provided, fetch and convert to base64
    if (dto.baseImage) {
      try {
        const { base64, mimeType } = await this.fetchImageAsBase64(
          dto.baseImage,
        );
        parts.push({ inlineData: { mimeType, data: base64 } });
      } catch (err) {
        this.logger.warn(`Failed to fetch base image: ${dto.baseImage}`, err);
        // Continue without the base image rather than failing the whole request
      }
    }

    parts.push({ text: prompt });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent?key=${apiKey}`;

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'image/png',
          },
        }),
      });
    } catch (err) {
      this.logger.error('Network error calling Gemini API', err);
      throw new InternalServerErrorException(
        'Failed to reach image generation service',
      );
    }

    if (!geminiResponse.ok) {
      const errData = (await geminiResponse
        .json()
        .catch(() => ({}))) as GeminiErrorResponse;
      this.logger.error('Gemini API error response', errData);
      throw new InternalServerErrorException(
        errData?.error?.message || 'Image generation service returned an error',
      );
    }

    const geminiData = (await geminiResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data: string; mimeType: string };
            text?: string;
          }>;
        };
      }>;
    };
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

    // Gemini returned no image — return the text description as fallback
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

  private async fetchImageAsBase64(
    imageUrl: string,
  ): Promise<{ base64: string; mimeType: string }> {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { base64, mimeType };
  }
}
