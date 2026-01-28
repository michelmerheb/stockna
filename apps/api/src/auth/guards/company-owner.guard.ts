// ok you are a member… but are you OWNER?
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthRequest } from '../types/auth-request.type';

@Injectable()
export class CompanyOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();

    // CompanyMemberGuard must run before this guard (so req.membership exists)
    const role = req.membership?.role;
    if (!role) throw new ForbiddenException('Missing membership context');

    if (role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can perform this action');
    }

    return true;
  }
}
