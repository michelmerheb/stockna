import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../types/auth-request.type';

export const CompanyMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    return req.membership;
  },
);
