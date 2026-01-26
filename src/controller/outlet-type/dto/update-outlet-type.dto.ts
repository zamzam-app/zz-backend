import { PartialType } from '@nestjs/mapped-types';
import { CreateOutletTypeDto } from './create-outlet-type.dto';

export class UpdateOutletTypeDto extends PartialType(CreateOutletTypeDto) {}
