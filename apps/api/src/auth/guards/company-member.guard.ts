//This guard is to see if a user is part of the company and if he can access this company
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthRequest } from '../types/auth-request.type';

@Injectable()
export class CompanyMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();

    // 1) userId from JWT
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Missing auth user');

    // 2) companyId from route params
    const companyIdParam = req.params?.companyId;
    const companyId = Array.isArray(companyIdParam)
      ? companyIdParam[0]
      : companyIdParam;
    if (!companyId) {
      // This guard is intended ONLY for routes that contain :companyId
      throw new ForbiddenException('Missing companyId in route');
    }

    // 3) membership check (fast + uses your compound unique)
    const membership = await this.prisma.membership.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this company');
    }

    // 4) Attach context to request (so services/controllers can reuse it)
    req.membership = { companyId, userId, role: membership.role };

    return true;
  }
}
