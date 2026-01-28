import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CurrentUserId } from 'src/auth/decorators/current-user-id.decorator';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { CompanyMemberGuard } from 'src/auth/guards/company-member.guard';
import { CompanyMembership } from 'src/auth/decorators/company-membership.decorator';
import { CompanyOwnerGuard } from 'src/auth/guards/company-owner.guard';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AddCompanyMemberDto } from './dto/add-company-member.dto';

@UseGuards(JwtAccessGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  async createCompany(
    @CurrentUserId() userId: string,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.createCompanyWithOwner(userId, dto);
  }

  @Get()
  async listMyCompanies(@CurrentUserId() userId: string) {
    return this.companiesService.listMyCompanies(userId);
  }

  @Get(':companyId')
  @UseGuards(CompanyMemberGuard)
  async getCompanyById(
    @CompanyMembership() membership: { companyId: string; role: string },
  ) {
    const company = await this.companiesService.getCompanyById(
      membership.companyId,
    );

    return {
      company,
      myRole: membership.role,
    };
  }

  @Post(':companyId/select')
  @UseGuards(CompanyMemberGuard)
  async selectCompany(
    @CurrentUserId() userId: string,
    @CompanyMembership() membership: { companyId: string; role: string },
  ) {
    return this.companiesService.selectCompany(userId, membership.companyId);
  }

  //Update company (OWNER only)
  @Patch(':companyId')
  @UseGuards(CompanyMemberGuard, CompanyOwnerGuard)
  async updateCompany(
    @CompanyMembership() membership: { companyId: string },
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateCompany(membership.companyId, dto);
  }

  // Get company members
  @Get(':companyId/members')
  @UseGuards(CompanyMemberGuard)
  async listMembers(@CompanyMembership() membership: { companyId: string }) {
    return this.companiesService.listMembers(membership.companyId);
  }

  // Add a member
  @Post(':companyId/members')
  @UseGuards(CompanyMemberGuard, CompanyOwnerGuard)
  async addMember(
    @CompanyMembership() membership: { companyId: string },
    @Body() dto: AddCompanyMemberDto,
  ) {
    return this.companiesService.addMember(membership.companyId, dto);
  }
}
