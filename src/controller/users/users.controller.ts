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
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ApiUserCreate,
  ApiUserFindAll,
  ApiUserFindOne,
  ApiUserUpdate,
  ApiUserChangePassword,
  ApiUserRemove,
} from './dto/user.swagger';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './interfaces/user.interface';
import { JwtPayload } from '../auth/interfaces/auth.interfaces';

/** Profile fields a non-admin may change on their own account. */
const SELF_UPDATABLE_FIELDS = ['name', 'email', 'dob', 'gender'];

@ApiTags('users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiUserCreate()
  async create(@Body() createUserDto: CreateUserDto) {
    const created = await this.usersService.create(createUserDto);
    // The saved document includes the password hash and otp: strip them.
    const safe = { ...created.toObject() } as Record<string, unknown>;
    delete safe.password;
    delete safe.otp;
    delete safe.pushTokens;
    return safe;
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiUserFindAll()
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiUserFindOne()
  findOne(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    // Admins may read any user; everyone else only themselves.
    if (req.user.role !== UserRole.ADMIN && req.user.sub !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    return this.usersService.findOne(id);
  }

  @Patch('push-token')
  @UseGuards(JwtAuthGuard)
  updatePushToken(
    @Request() req: { user: JwtPayload },
    @Body() dto: UpdatePushTokenDto,
  ) {
    return this.usersService.updatePushToken(req.user.sub, dto);
  }

  @Delete('push-token')
  @UseGuards(JwtAuthGuard)
  removePushToken(
    @Request() req: { user: JwtPayload },
    @Body() body?: { token?: string; deviceId?: string },
  ) {
    return this.usersService.removePushToken(req.user.sub, body || {});
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiUserUpdate()
  update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Admins may edit anyone. Everyone else may only edit their own profile,
    // and only the fields in SELF_UPDATABLE_FIELDS (never role, password, ...).
    if (req.user.role !== UserRole.ADMIN) {
      if (req.user.sub !== id) {
        throw new ForbiddenException('You can only update your own profile');
      }
      const disallowed = Object.keys(updateUserDto).filter(
        (key) => !SELF_UPDATABLE_FIELDS.includes(key),
      );
      if (disallowed.length > 0) {
        throw new ForbiddenException(
          `You are not allowed to update: ${disallowed.join(', ')}`,
        );
      }
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Post('change-password/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @ApiUserChangePassword()
  changePassword(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    // Needs the old password, so it is only ever for your own account.
    if (req.user.sub !== id) {
      throw new ForbiddenException('You can only change your own password');
    }
    return this.usersService.changePassword(
      id,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiUserRemove()
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
