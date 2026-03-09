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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiCategoryCreate,
  ApiCategoryFindAll,
  ApiCategoryFindOne,
  ApiCategoryRemove,
  ApiCategoryUpdate,
} from './dto/category.swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../users/interfaces/user.interface';

@ApiTags('category')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCategoryCreate()
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @Public()
  @ApiCategoryFindAll()
  findAll(@Query() query: QueryCategoryDto) {
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiCategoryFindOne()
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCategoryUpdate()
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCategoryRemove()
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
