import { PartialType } from '@nestjs/swagger';
import { CreateCakeCustomizationOptionDto } from './create-cake-customization-option.dto';

export class UpdateCakeCustomizationOptionDto extends PartialType(
  CreateCakeCustomizationOptionDto,
) {}
