import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUploadedCakeDto } from './dto/create-uploaded-cake.dto';
import { ApiUploadedCakeCreate } from './dto/uploaded-cake.swagger';
import { UploadedCakesService } from './uploaded-cakes.service';

@ApiTags('uploaded-cakes')
@Controller('uploaded-cakes')
export class UploadedCakesController {
  constructor(private readonly uploadedCakesService: UploadedCakesService) {}

  @Post()
  @Public()
  @ApiUploadedCakeCreate()
  create(@Body() dto: CreateUploadedCakeDto) {
    return this.uploadedCakesService.create(dto);
  }
}
