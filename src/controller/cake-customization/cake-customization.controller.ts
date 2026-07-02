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
} from '@nestjs/common';
import { CakeCustomizationService } from './cake-customization.service';
import { CreateCakeCustomizationOptionDto } from './dto/create-cake-customization-option.dto';
import { QueryCakeCustomizationOptionDto } from './dto/query-cake-customization-option.dto';
import { UpdateCakeCustomizationOptionDto } from './dto/update-cake-customization-option.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiCakeCustomizationOptionCreate,
  ApiCakeCustomizationOptionFindAll,
  ApiCakeCustomizationOptionFindOne,
  ApiCakeCustomizationOptionRemove,
  ApiCakeCustomizationOptionUpdate,
} from './dto/cake-customization.swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../users/interfaces/user.interface';

@ApiTags('cake-customization')
@Controller('cake-customization')
export class CakeCustomizationController {
  constructor(
    private readonly customizationService: CakeCustomizationService,
  ) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCakeCustomizationOptionCreate()
  create(@Body() createDto: CreateCakeCustomizationOptionDto) {
    return this.customizationService.create(createDto);
  }

  @Get()
  @Public()
  @ApiCakeCustomizationOptionFindAll()
  findAll(@Query() query: QueryCakeCustomizationOptionDto) {
    return this.customizationService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiCakeCustomizationOptionFindOne()
  findOne(@Param('id') id: string) {
    return this.customizationService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCakeCustomizationOptionUpdate()
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCakeCustomizationOptionDto,
  ) {
    return this.customizationService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCakeCustomizationOptionRemove()
  remove(@Param('id') id: string) {
    return this.customizationService.remove(id);
  }
}
