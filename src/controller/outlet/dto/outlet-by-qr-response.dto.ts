import { ApiProperty } from '@nestjs/swagger';
import { IForm } from 'src/controller/forms/interfaces/form.interface';

export class OutletByQrTokenResponseDto {
  @ApiProperty({ description: 'Outlet ID' })
  _id: string;

  @ApiProperty({ description: 'Outlet name' })
  name: string;

  @ApiProperty({
    description:
      'Populated form document (with questions) or null if outlet has no form',
    nullable: true,
  })
  form: IForm | null;
}
