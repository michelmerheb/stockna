import { IsIn, IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  name: string;

  @IsString()
  @IsIn(['USD', 'LBP'])
  baseCurrencyCode: string;
}
