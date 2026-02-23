import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FormService } from './form.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { QueryFormDto } from './dto/query-form.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { Request as ExpressRequest } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/interfaces/user.interface';
import {
  ApiFormCreate,
  ApiFormFindAll,
  ApiFormFindOne,
  ApiFormUpdate,
  ApiFormRemove,
} from './dto/form.swagger';

@ApiTags('forms')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
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
  findAll(@Query() query: QueryFormDto) {
    return this.formService.findAll(query);
  }

  @Get(':id')
  @ApiFormFindOne()
  async findOne(@Param('id') id: string) {
    return this.formService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiFormUpdate()
  update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto) {
    return this.formService.update(id, updateFormDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiFormRemove()
  remove(@Param('id') id: string) {
    return this.formService.remove(id);
  }
}
