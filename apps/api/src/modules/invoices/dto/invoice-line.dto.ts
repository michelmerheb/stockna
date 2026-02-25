import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsString()
  @IsNotEmpty()
  unitPrice!: string;

  @IsOptional()
  @IsString()
  discount?: string;

  @IsOptional()
  @IsString()
  tax?: string;
}
