import {
  Controller,
  Post,
  UseGuards,
  Body,
  Get,
  Query,
  Param,
  Patch,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAccessGuard } from 'src/auth/guards/jwt-access.guard';
import { CompanyContextGuard } from 'src/auth/guards/company-context.guard';
import { CompanyMembership } from 'src/auth/decorators/company-membership.decorator';
import type { CompanyMembershipContext } from 'src/auth/types/auth-request.type';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients.query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@UseGuards(JwtAccessGuard, CompanyContextGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async createClient(
    @CompanyMembership() membership: CompanyMembershipContext,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.createClient(membership.companyId, dto);
  }

  @Get()
  async list(
    @CompanyMembership() membership: CompanyMembershipContext,
    @Query() query: ListClientsQueryDto,
  ) {
    return this.clientsService.list(membership.companyId, query);
  }

  @Get(':id')
  async getById(
    @CompanyMembership() membership: CompanyMembershipContext,
    @Param('id') id: string,
  ) {
    return this.clientsService.getById(membership.companyId, id);
  }

  @Patch(':id')
  async updateClient(
    @CompanyMembership() membership: CompanyMembershipContext,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.updateClient(membership.companyId, id, dto);
  }
}
