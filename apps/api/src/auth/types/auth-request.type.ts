import type { Request } from 'express';
import type { UserRole } from '@stockna/database/dist/generated/prisma/enums';

export type AuthUser = {
  userId?: string;
  email?: string;
};

export type CompanyMembershipContext = {
  companyId: string;
  userId: string;
  role: UserRole;
};

export type AuthRequest = Request & {
  user?: AuthUser;
  membership?: CompanyMembershipContext;
};
