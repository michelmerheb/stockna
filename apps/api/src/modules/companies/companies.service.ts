import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { JwtService } from '@nestjs/jwt';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AddCompanyMemberDto } from './dto/add-company-member.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private companySelect = {
    id: true,
    name: true,
    baseCurrencyCode: true,
    createdAt: true,
    updatedAt: true,
  };

  async createCompanyWithOwner(userId: string, dto: CreateCompanyDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1) Creates the company
      const company = await tx.company.create({
        data: {
          name: dto.name,
          baseCurrencyCode: dto.baseCurrencyCode,
        },
        select: this.companySelect,
      });

      // 2) Create membership as OWNER for the current user
      const membership = await tx.membership.create({
        data: {
          companyId: company.id,
          userId,
          role: 'OWNER',
        },
        select: {
          role: true,
          companyId: true,
          userId: true,
        },
      });

      return {
        company,
        myRole: membership.role,
      };
    });
  }

  async listMyCompanies(userId: string) {
    // Query memberships and join company in one shot
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: {
        role: true,
        company: {
          select: this.companySelect,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return memberships.map((m) => ({
      company: m.company,
      myRole: m.role,
    }));
  }

  async getCompanyById(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: this.companySelect,
    });

    if (!company) throw new NotFoundException('Company not found');

    return company;
  }

  async selectCompany(userId: string, companyId: string) {
    // membership already checked by CompanyMemberGuard, but we can still keep it safe:
    const membership = await this.prisma.membership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found for this company');
    }

    // Put companyId in token payload so frontend always has context
    const payload = { sub: userId, companyId, role: membership.role };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      companyId,
      myRole: membership.role,
    };
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDto) {
    // Optional: block empty patch calls
    if (!dto.name && !dto.baseCurrencyCode) {
      throw new BadRequestException('Nothing to update');
    }

    // Ensure company exists (nice error)
    const exists = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Company not found');

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.baseCurrencyCode
          ? { baseCurrencyCode: dto.baseCurrencyCode }
          : {}),
      },
      select: this.companySelect,
    });
  }

  async listMembers(companyId: string) {
    const members = await this.prisma.membership.findMany({
      where: { companyId },
      select: {
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
  }

  async addMember(companyId: string, dto: AddCompanyMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true },
    });

    if (!user) throw new NotFoundException('User not found');

    try {
      const membership = await this.prisma.membership.create({
        data: {
          companyId,
          userId: user.id,
          role: dto.role ?? 'EMPLOYEE',
        },
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      });

      return {
        role: membership.role,
        joinedAt: membership.createdAt,
        user: membership.user,
      };
    } catch {
      throw new BadRequestException('User is already a member of this company');
    }
  }
}
