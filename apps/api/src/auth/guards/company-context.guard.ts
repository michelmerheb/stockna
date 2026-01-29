import {
  CanActivate,
  ExecutionContext,
  BadRequestException,
  UnauthorizedException,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { AuthRequest } from '../types/auth-request.type';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CompanyContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();

    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Missing auth user');

    const headerCompanyId = req.header('x-company-id');
    const companyId = headerCompanyId ?? req.user?.companyId ?? null;

    if (!companyId) {
      throw new BadRequestException(
        'Missing company context. Provide X-Company-Id header or select a company first.',
      );
    }

    // Verify membership in DB
    const membership = await this.prisma.membership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { role: true, companyId: true, userId: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this company');
    }

    req.membership = {
      companyId: membership.companyId,
      userId: membership.userId,
      role: membership.role,
    };

    return true;
  }
}
