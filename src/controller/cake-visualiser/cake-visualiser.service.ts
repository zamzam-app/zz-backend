import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VisualiseCakeDto } from './dto/visualise-cake.dto';

@Injectable()
export class CakeVisualiserService {
  private readonly logger = new Logger(CakeVisualiserService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn(
        'GEMINI_API_KEY is missing. Cake Visualiser will be disabled.',
      );
    }
  }

  async visualise(dto: VisualiseCakeDto) {
    if (!this.genAI) {
      return {
        success: false,
        message: 'Coming Soon',
        placeholderImage:
          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=1089&auto=format&fit=crop', // Generic cake placeholder
      };
    }

    try {
      // Using gemini-2.5-flash-image (stable free tier model)
      const modelName = 'gemini-2.5-flash-image';
      this.logger.debug(`Using Gemini model: ${modelName}`);
      const model = this.genAI.getGenerativeModel({ model: modelName });

      const prompt = `
        You are an expert cake designer for "ZamZam" (also known as Nano Banana). 
        Based on the following user customization, describe a stunning, realistic, and delicious cake in detail.
        
        CRITICAL INSTRUCTION: Without changing any changes in the existing image (especially preserve ZamZam's branding chips on top of the cake) except the customer's request generate the description. Whenever a customer sends a request, make changes on those requests only, but keep the existing cake image style and branding intact.

        Customizations:
        - Base Theme/Image Reference: ${dto.baseImage || 'Standard ZamZam Cake'}
        - Shape: ${dto.shape || 'Keep original'}
        - Flavor: ${dto.flavor || 'Keep original'}
        - Custom Text: ${dto.text || 'None'}
        - Extra Requests: ${dto.extraRequests || 'None'}

        Generate a vivid, professional description that we can use to visualize this cake. 
        Start with an enthusiastic summary.
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        success: true,
        prompt: text,
      };
    } catch (error: unknown) {
      this.logger.error('Error in Cake Visualiser:', error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate cake visualization';

      // Safely log response error if it exists (common in API clients)
      if (error && typeof error === 'object' && 'response' in error) {
        const errObj = error as { response?: { data?: unknown } };
        const responseData = errObj.response?.data ?? errObj.response;
        if (responseData) {
          this.logger.error('API Response Error:', responseData);
        }
      }

      throw new InternalServerErrorException(errorMessage);
    }
  }
}
