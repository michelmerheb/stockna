// apps/api/src/modules/invoices/invoices.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { InvoicesService } from './invoices.service';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';

// ✅ Use your existing guards (paths may differ in your project)
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { CompanyContextGuard } from 'src/auth/guards/company-context.guard';
import { CompanyMemberGuard } from 'src/auth/guards/company-member.guard';

// If you already have an AuthRequest type, import it and delete the interface below.
// import type { AuthRequest } from '../companies/types/auth-request.type';

interface AuthRequest extends Request {
  user?: { userId: string };
  company?: { companyId: string; role: string };
}

@Controller('invoices')
@UseGuards(JwtAccessGuard, CompanyContextGuard, CompanyMemberGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  async createDraft(@Req() req: AuthRequest, @Body() dto: CreateInvoiceDto) {
    const companyId = req.company?.companyId;
    return this.invoicesService.createDraft(companyId as string, dto);
  }

  @Get()
  async list(@Req() req: AuthRequest, @Query() query: ListInvoicesQueryDto) {
    const companyId = req.company?.companyId;

    return this.invoicesService.list(companyId as string, {
      status: query.status,
      clientId: query.clientId,
    });
  }

  @Get(':invoiceId')
  async getById(
    @Req() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    const companyId = req.company?.companyId;
    return this.invoicesService.getById(companyId as string, invoiceId);
  }

  // Edit invoice header/lines (DRAFT only)
  @Patch(':invoiceId')
  async updateDraft(
    @Req() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    const companyId = req.company?.companyId;
    return this.invoicesService.updateDraft(
      companyId as string,
      invoiceId,
      dto,
    );
  }

  // DRAFT -> SENT
  @Post(':invoiceId/send')
  async send(@Req() req: AuthRequest, @Param('invoiceId') invoiceId: string) {
    const companyId = req.company?.companyId;
    return this.invoicesService.send(companyId as string, invoiceId);
  }

  // DRAFT/SENT -> VOID (service enforces rules)
  @Post(':invoiceId/void')
  async voidInvoice(
    @Req() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    const companyId = req.company?.companyId;
    return this.invoicesService.void(companyId as string, invoiceId);
  }

  /**
   * Optional endpoint (nice for debugging while you build Payments module)
   * You can remove it later, or keep it admin-only.
   */
  @Post(':invoiceId/recompute-paid')
  async recomputePaid(
    @Req() req: AuthRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    const companyId = req.company?.companyId;
    return this.invoicesService.recomputePaidAmounts(
      companyId as string,
      invoiceId,
    );
  }
}
