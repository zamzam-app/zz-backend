import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { CustomCakeService } from './custom-cake.service';
import { CreateCustomCakeDto } from './dto/create-custom-cake.dto';
import { ApiCustomCakeCreate } from './dto/custom-cake.swagger';

@ApiTags('custom-cakes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('custom-cakes')
export class CustomCakeController {
  constructor(private readonly customCakeService: CustomCakeService) {}

  @Post()
  @ApiCustomCakeCreate()
  create(
    @Body() dto: CreateCustomCakeDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.customCakeService.create(req.user.sub, dto);
  }
}
