import { Controller, Post, Body } from '@nestjs/common';
import { CakeVisualiserService } from './cake-visualiser.service';
import { VisualiseCakeDto } from './dto/visualise-cake.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('cake-visualiser')
@Controller('visualise-cake')
export class CakeVisualiserController {
  constructor(private readonly cakeVisualiserService: CakeVisualiserService) {}

  @Post()
  @Public() // Making it public for now as it's likely used by users on detail pages
  @ApiOperation({ summary: 'Visualise a custom cake using AI' })
  @ApiResponse({
    status: 200,
    description: 'Cake visualization generated successfully.',
  })
  async visualise(@Body() visualiseCakeDto: VisualiseCakeDto) {
    return this.cakeVisualiserService.visualise(visualiseCakeDto);
  }
}
