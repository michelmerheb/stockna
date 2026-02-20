import {
  ArrayMinSize,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { UpdateInvoiceDto } from './update-invoice.dto';
import { Type } from 'class-transformer';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  // Who we are billing
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  baseCurrencyCode!: string;

  @IsOptional()
  @IsString()
  fxRateToBase?: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  @ArrayMinSize(1)
  lines!: InvoiceLineDto[];
}
