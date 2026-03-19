import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CustomCakeService } from './custom-cake.service';
import { CreateCustomCakeDto } from './dto/create-custom-cake.dto';
import { ApiCustomCakeCreate } from './dto/custom-cake.swagger';

@ApiTags('custom-cakes')
@Controller('custom-cakes')
export class CustomCakeController {
  constructor(private readonly customCakeService: CustomCakeService) {}

  @Post()
  @Public()
  @ApiCustomCakeCreate()
  create(@Body() dto: CreateCustomCakeDto) {
    return this.customCakeService.create(dto);
  }
}
