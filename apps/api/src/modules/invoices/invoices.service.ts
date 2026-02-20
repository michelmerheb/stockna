// apps/api/src/modules/invoices/invoices.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

// If this import doesn't match your generated client path, adjust it.
import { Prisma } from '@stockna/database';

type DecimalLike = Prisma.Decimal | string | number;

type CreateInvoiceLineInput = {
  description: string;
  quantity?: DecimalLike; // default 1
  unitPrice: DecimalLike;
  discount?: DecimalLike; // absolute amount (v1)
  tax?: DecimalLike; // absolute amount (v1)
};

type CreateInvoiceInput = {
  clientId: string;
  currencyCode: string;
  fxRateToBase?: DecimalLike; // required if currency != company base currency
  issuedAt?: Date;
  dueAt?: Date;
  notes?: string;
  lines: CreateInvoiceLineInput[];
};

type UpdateDraftInvoiceInput = {
  clientId?: string;
  currencyCode?: string;
  fxRateToBase?: DecimalLike;
  issuedAt?: Date | null;
  dueAt?: Date | null;
  notes?: string | null;
  lines?: CreateInvoiceLineInput[]; // v1: replace-all lines for simplicity
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------
  // Public API
  // -----------------------------

  async createDraft(companyId: string, input: CreateInvoiceInput) {
    this.assertLinesNotEmpty(input.lines);

    // 1) Validate client belongs to company
    await this.assertClientInCompany(companyId, input.clientId);

    // 2) Load company for base currency
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { baseCurrencyCode: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    // 3) Decide fxRateToBase
    const fxRateToBase = this.resolveFxRateToBase(
      input.currencyCode,
      company.baseCurrencyCode,
      input.fxRateToBase,
    );

    // 4) Compute lines + totals
    const computed = this.computeInvoiceFromLines(input.lines, fxRateToBase);

    // 5) Generate invoiceNumber (v1)
    const invoiceNumber = await this.generateNextInvoiceNumber(companyId);

    // 6) Create invoice + lines in a transaction
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          clientId: input.clientId,
          invoiceNumber,
          invoiceStatus: 'DRAFT',
          currencyCode: input.currencyCode,
          fxRateToBase,

          issuedAt: input.issuedAt ?? null,
          dueAt: input.dueAt ?? null,
          notes: input.notes ?? null,

          subtotal: computed.subtotal,
          discountTotal: computed.discountTotal,
          taxTotal: computed.taxTotal,
          total: computed.total,

          baseSubtotal: computed.baseSubtotal,
          baseTotal: computed.baseTotal,

          amountPaid: new Prisma.Decimal(0),
          amountDue: computed.total, // paid=0 initially
        },
      });

      await tx.invoiceLine.createMany({
        data: computed.lines.map((l) => ({
          invoiceId: invoice.id,
          position: l.position,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          tax: l.tax,
          lineTotal: l.lineTotal,
        })),
      });

      // Return with lines
      return tx.invoice.findFirst({
        where: { id: invoice.id, companyId },
        include: { lines: { orderBy: { position: 'asc' } } },
      });
    });
  }

  async getById(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        client: true,
        lines: { orderBy: { position: 'asc' } },
        allocations: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async list(
    companyId: string,
    params?: { status?: string; clientId?: string },
  ) {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...(params?.status ? { invoiceStatus: params.status as any } : {}),
      ...(params?.clientId ? { clientId: params.clientId } : {}),
    };

    return this.prisma.invoice.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: { client: true },
      take: 100,
    });
  }

  async updateDraft(
    companyId: string,
    invoiceId: string,
    input: UpdateDraftInvoiceInput,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        invoiceStatus: true,
        currencyCode: true,
        clientId: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.invoiceStatus !== 'DRAFT') {
      throw new ForbiddenException('Only DRAFT invoices can be edited');
    }

    const newClientId = input.clientId ?? invoice.clientId;
    await this.assertClientInCompany(companyId, newClientId);

    // If currency changes, fxRate may need to change too.
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { baseCurrencyCode: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const newCurrencyCode = input.currencyCode ?? invoice.currencyCode;
    const newFxRateToBase = this.resolveFxRateToBase(
      newCurrencyCode,
      company.baseCurrencyCode,
      input.fxRateToBase,
    );

    // If lines provided → replace all lines (simple v1)
    const shouldReplaceLines = Array.isArray(input.lines);

    return await this.prisma.$transaction(async (tx) => {
      let computed: ReturnType<typeof this.computeInvoiceFromLines> | null =
        null;

      if (shouldReplaceLines) {
        this.assertLinesNotEmpty(input.lines!);
        computed = this.computeInvoiceFromLines(input.lines!, newFxRateToBase);

        // delete + recreate lines
        await tx.invoiceLine.deleteMany({ where: { invoiceId } });

        await tx.invoiceLine.createMany({
          data: computed.lines.map((l) => ({
            invoiceId,
            position: l.position,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            tax: l.tax,
            lineTotal: l.lineTotal,
          })),
        });
      }

      // Keep amountPaid as-is; amountDue must track total - amountPaid.
      const currentPaid = await tx.invoice.findFirst({
        where: { id: invoiceId, companyId },
        select: { amountPaid: true },
      });
      if (!currentPaid) throw new NotFoundException('Invoice not found');

      const nextTotal = computed ? computed.total : undefined;
      const nextBaseSubtotal = computed ? computed.baseSubtotal : undefined;
      const nextBaseTotal = computed ? computed.baseTotal : undefined;
      const nextSubtotal = computed ? computed.subtotal : undefined;
      const nextDiscountTotal = computed ? computed.discountTotal : undefined;
      const nextTaxTotal = computed ? computed.taxTotal : undefined;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          clientId: newClientId,
          currencyCode: newCurrencyCode,
          fxRateToBase: newFxRateToBase,

          issuedAt: input.issuedAt === undefined ? undefined : input.issuedAt,
          dueAt: input.dueAt === undefined ? undefined : input.dueAt,
          notes: input.notes === undefined ? undefined : input.notes,

          subtotal: nextSubtotal,
          discountTotal: nextDiscountTotal,
          taxTotal: nextTaxTotal,
          total: nextTotal,

          baseSubtotal: nextBaseSubtotal,
          baseTotal: nextBaseTotal,

          amountDue:
            nextTotal === undefined
              ? undefined
              : new Prisma.Decimal(nextTotal).minus(currentPaid.amountPaid),
        },
      });

      return tx.invoice.findFirst({
        where: { id: updated.id, companyId },
        include: { lines: { orderBy: { position: 'asc' } }, client: true },
      });
    });
  }

  async send(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        invoiceStatus: true,
        issuedAt: true,
        dueAt: true,
        total: true,
        amountDue: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.invoiceStatus !== 'DRAFT') {
      throw new ForbiddenException('Only DRAFT invoices can be sent');
    }

    // Basic safety checks before sending
    if (invoice.total.lte(0)) {
      throw new BadRequestException('Invoice total must be greater than 0');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceStatus: 'SENT',
        issuedAt: invoice.issuedAt ?? new Date(),
        // dueAt can remain null if you allow it, but usually it should exist:
        // dueAt: invoice.dueAt ?? this.addDays(new Date(), 14),
      },
      include: { lines: { orderBy: { position: 'asc' } }, client: true },
    });
  }

  async void(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { invoiceStatus: true, amountPaid: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Typical ERP rule: once money is paid, voiding is not allowed (or requires credit note).
    if (invoice.amountPaid.gt(0)) {
      throw new ForbiddenException('Cannot void an invoice with payments');
    }

    if (invoice.invoiceStatus === 'VOID') return { ok: true };

    if (invoice.invoiceStatus === 'PAID') {
      throw new ForbiddenException('Cannot void a PAID invoice');
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { invoiceStatus: 'VOID' },
    });

    return { ok: true };
  }

  // Optional helper for later (Payment module):
  // Recompute amountPaid/amountDue based on PaymentAllocation rows
  async recomputePaidAmounts(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { total: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const sum = await this.prisma.paymentAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });

    const amountPaid = sum._sum.amount ?? new Prisma.Decimal(0);
    const amountDue = invoice.total.minus(amountPaid);

    // Status update logic can be added later (PARTIALLY_PAID / PAID)
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, amountDue },
      include: { lines: { orderBy: { position: 'asc' } }, client: true },
    });
  }

  // -----------------------------
  // Core computation helpers
  // -----------------------------

  private computeInvoiceFromLines(
    lines: CreateInvoiceLineInput[],
    fxRateToBase: Prisma.Decimal,
  ) {
    const computedLines = lines.map((l, idx) => {
      const quantity = this.dec(l.quantity ?? 1);
      const unitPrice = this.dec(l.unitPrice);
      const discount = this.dec(l.discount ?? 0);
      const tax = this.dec(l.tax ?? 0);

      if (quantity.lte(0))
        throw new BadRequestException('Line quantity must be > 0');
      if (unitPrice.lt(0))
        throw new BadRequestException('Line unitPrice must be >= 0');
      if (discount.lt(0))
        throw new BadRequestException('Line discount must be >= 0');
      if (tax.lt(0)) throw new BadRequestException('Line tax must be >= 0');

      const gross = quantity.mul(unitPrice);
      const lineTotal = gross.minus(discount).plus(tax);

      return {
        position: idx + 1,
        description: l.description?.trim() || '',
        quantity,
        unitPrice,
        discount,
        tax,
        gross,
        lineTotal,
      };
    });

    for (const l of computedLines) {
      if (!l.description)
        throw new BadRequestException('Line description is required');
      if (l.lineTotal.lt(0))
        throw new BadRequestException('Line total cannot be negative');
    }

    const subtotal = computedLines.reduce(
      (acc, l) => acc.plus(l.gross),
      this.dec(0),
    );
    const discountTotal = computedLines.reduce(
      (acc, l) => acc.plus(l.discount),
      this.dec(0),
    );
    const taxTotal = computedLines.reduce(
      (acc, l) => acc.plus(l.tax),
      this.dec(0),
    );
    const total = subtotal.minus(discountTotal).plus(taxTotal);

    const baseSubtotal = subtotal.mul(fxRateToBase);
    const baseTotal = total.mul(fxRateToBase);

    return {
      lines: computedLines.map((l) => ({
        position: l.position,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        tax: l.tax,
        lineTotal: l.lineTotal,
      })),
      subtotal,
      discountTotal,
      taxTotal,
      total,
      baseSubtotal,
      baseTotal,
    };
  }

  private resolveFxRateToBase(
    currencyCode: string,
    baseCurrencyCode: string,
    provided?: DecimalLike,
  ) {
    if (currencyCode === baseCurrencyCode) return new Prisma.Decimal(1);
    if (provided === undefined || provided === null) {
      throw new BadRequestException(
        `fxRateToBase is required when invoice currency (${currencyCode}) != company base currency (${baseCurrencyCode})`,
      );
    }
    const fx = this.dec(provided);
    if (fx.lte(0)) throw new BadRequestException('fxRateToBase must be > 0');
    return fx;
  }

  private async assertClientInCompany(companyId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found in company');
  }

  private assertLinesNotEmpty(lines: CreateInvoiceLineInput[]) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new BadRequestException('Invoice must have at least 1 line');
    }
  }

  private async generateNextInvoiceNumber(companyId: string) {
    // v1 approach: read latest invoiceNumber and increment if numeric
    const last = await this.prisma.invoice.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    const lastNum = last?.invoiceNumber
      ? parseInt(last.invoiceNumber, 10)
      : NaN;
    const nextNum = Number.isFinite(lastNum) ? lastNum + 1 : 1;

    // pad to 6 digits: 000001
    return String(nextNum).padStart(6, '0');
  }

  private dec(v: DecimalLike) {
    // Prisma.Decimal accepts string/number/Decimal
    return new Prisma.Decimal(v as any);
  }
}
