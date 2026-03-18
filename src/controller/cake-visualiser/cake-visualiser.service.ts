import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { VisualiseCakeDto } from './dto/visualise-cake.dto';

interface VertexPrediction {
  bytesBase64Encoded?: string;
  mimeType?: string;
}

interface VertexResponse {
  predictions?: VertexPrediction[];
  error?: { message?: string };
}

@Injectable()
export class CakeVisualiserService {
  private readonly logger = new Logger(CakeVisualiserService.name);

  /** Text → image only (no referenceImages). */
  private readonly GEN_MODEL = 'imagen-4.0-generate-001';
  /** Image + prompt editing (referenceImages / REFERENCE_TYPE_RAW). */
  private readonly EDIT_MODEL = 'imagen-3.0-capability-001';
  // private readonly EDIT_MODEL = 'imagen-4.0-ultra-generate-001';

  private readonly PLACEHOLDER_IMAGE =
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800';

  constructor(private readonly configService: ConfigService) {}

  async visualiseCake(dto: VisualiseCakeDto) {
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT');
    const clientEmail = this.configService.get<string>('GOOGLE_CLIENT_EMAIL');
    const privateKeyRaw = this.configService.get<string>('GOOGLE_PRIVATE_KEY');
    const location =
      this.configService.get<string>('GOOGLE_CLOUD_LOCATION') || 'us-central1';

    // Feature disabled — credentials not configured
    if (!projectId || !clientEmail || !privateKeyRaw) {
      return {
        success: false,
        message: 'Coming Soon',
        placeholderImage: this.PLACEHOLDER_IMAGE,
      };
    }

    // Convert escaped \n back to real newlines (needed when reading from .env)
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    const prompt = this.buildPrompt(dto);

    // Get a short-lived access token using the service account credentials
    let accessToken: string;
    try {
      const auth = new GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      accessToken = (await auth.getAccessToken()) as string;
    } catch (err) {
      this.logger.error('Failed to obtain Google access token', err);
      throw new InternalServerErrorException(
        'Authentication with Google Cloud failed',
      );
    }

    const baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models`;

    const genPayload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        outputOptions: { mimeType: 'image/png' },
      },
    };

    let endpoint: string;
    let requestBody: object;

    if (dto.baseImage) {
      try {
        const { base64 } = await this.fetchImageAsBase64(dto.baseImage);
        endpoint = `${baseUrl}/${this.EDIT_MODEL}:predict`;
        requestBody = {
          instances: [
            {
              prompt,
              referenceImages: [
                {
                  referenceType: 'REFERENCE_TYPE_RAW',
                  referenceId: 1,
                  referenceImage: { bytesBase64Encoded: base64 },
                },
              ],
            },
          ],
          parameters: {
            sampleCount: 1,
            outputOptions: { mimeType: 'image/png' },
          },
        };
      } catch (err) {
        this.logger.warn(`Failed to fetch base image: ${dto.baseImage}`, err);
        endpoint = `${baseUrl}/${this.GEN_MODEL}:predict`;
        requestBody = genPayload;
      }
    } else {
      endpoint = `${baseUrl}/${this.GEN_MODEL}:predict`;
      requestBody = genPayload;
    }

    let vertexRes: Response;
    try {
      vertexRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      this.logger.error('Network error calling Vertex AI', err);
      throw new InternalServerErrorException(
        'Failed to reach image generation service',
      );
    }

    const vertexData = (await vertexRes.json()) as VertexResponse;

    if (!vertexRes.ok) {
      this.logger.error('Vertex AI error response', vertexData);
      throw new InternalServerErrorException(
        vertexData?.error?.message ||
          'Image generation service returned an error',
      );
    }

    const prediction = vertexData?.predictions?.[0];

    if (!prediction?.bytesBase64Encoded) {
      this.logger.warn('Vertex AI returned no image in predictions');
      throw new InternalServerErrorException(
        'No image returned from Vertex AI',
      );
    }

    return {
      success: true,
      imageBase64: prediction.bytesBase64Encoded,
      mimeType: prediction.mimeType || 'image/png',
      prompt: '',
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
