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
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';
import { Request as ExpressRequest } from 'express';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  ApiAddressCreate,
  ApiAddressFindAll,
  ApiAddressFindOne,
  ApiAddressRemove,
  ApiAddressUpdate,
} from './dto/address.swagger';

@ApiTags('address')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('address')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiAddressCreate()
  create(
    @Body() createAddressDto: CreateAddressDto,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.addressService.create(createAddressDto, req.user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiAddressFindAll()
  findAll() {
    return this.addressService.findAll();
  }

  @Get(':id')
  @ApiAddressFindOne()
  async findOne(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    return this.addressService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiAddressUpdate()
  update(@Param('id') id: string, @Body() updateAddressDto: UpdateAddressDto) {
    return this.addressService.update(id, updateAddressDto);
  }

  @Delete(':id')
  @ApiAddressRemove()
  remove(@Param('id') id: string) {
    return this.addressService.remove(id);
  }
}
