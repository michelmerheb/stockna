import {
  ArrayMinSize,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  // Who we are billing
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  currencyCode!: string;

  @IsOptional()
  @IsString()
  fxRateToBase?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  issuedAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  @ArrayMinSize(1)
  lines!: InvoiceLineDto[];
}
