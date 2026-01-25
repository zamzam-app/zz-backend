import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiProductCreate,
  ApiProductFindAll,
  ApiProductFindOne,
  ApiProductRemove,
  ApiProductUpdate,
} from './dto/product.swagger';

@ApiTags('product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiProductCreate()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Get()
  @ApiProductFindAll()
  findAll() {
    return this.productService.findAll();
  }

  @Get(':id')
  @ApiProductFindOne()
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @ApiProductUpdate()
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiProductRemove()
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
