import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum InvoiceStatusEnum {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
}

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatusEnum)
  status?: InvoiceStatusEnum;

  @IsOptional()
  @IsString()
  clientId?: string;
}
