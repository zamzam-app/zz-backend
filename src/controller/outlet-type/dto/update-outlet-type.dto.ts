import { PartialType } from '@nestjs/swagger';
import { CreateOutletTypeDto } from './create-outlet-type.dto';

export class UpdateOutletTypeDto extends PartialType(CreateOutletTypeDto) {}
