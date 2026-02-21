import { ApiOperation, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export const ApiUpdateUserOperation = ApiOperation({
  summary: 'Update a user by ID',
});

export class UpdateUserDto extends PartialType(CreateUserDto) {}
