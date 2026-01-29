import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients.query.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Prisma } from '@stockna/database';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async createClient(companyId: string, dto: CreateClientDto) {
    try {
      await this.prisma.client.create({
        data: {
          companyId,
          name: dto.name.trim(),
          email: dto.email?.trim() ?? null,
          phone: dto.phone?.trim() ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Client with this email already exists');
        }
      }
      throw err;
    }
  }

  async list(companyId: string, query: ListClientsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      companyId,
      ...(query.q
        ? {
            name: {
              contains: query.q,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
    });

    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async updateClient(companyId: string, id: string, dto: UpdateClientDto) {
    // Ensure exists inside this company (prevents cross-company access)
    await this.getById(companyId, id);

    try {
      return await this.prisma.client.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.email !== undefined ? { name: dto.email.trim() } : null),
          ...(dto.phone !== undefined ? { name: dto.phone.trim() } : null),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Client with this email already exists');
        }
      }
      throw err;
    }
  }
}
