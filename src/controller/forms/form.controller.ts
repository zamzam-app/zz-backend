import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FormService } from './form.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { Request as ExpressRequest } from 'express';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  ApiFormCreate,
  ApiFormFindAll,
  ApiFormFindOne,
  ApiFormRemove,
  ApiFormUpdate,
} from './dto/form.swagger';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  @ApiFormCreate()
  create(
    @Body() createFormDto: CreateFormDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.formService.create(createFormDto, req.user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiFormFindAll()
  findAll() {
    return this.formService.findAll();
  }

  @Get(':id')
  @ApiFormFindOne()
  async findOne(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.formService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiFormUpdate()
  update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto) {
    return this.formService.update(id, updateFormDto);
  }

  @Delete(':id')
  @ApiFormRemove()
  remove(@Param('id') id: string) {
    return this.formService.remove(id);
  }
}
