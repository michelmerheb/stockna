import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDate,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineDto } from './invoice-line.dto';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  fxRateToBase?: string;

  // Allow null to clear dates (service handles undefined vs null)
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  issuedAt?: Date | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueAt?: Date | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  @ArrayMinSize(1)
  lines!: InvoiceLineDto[];
}
