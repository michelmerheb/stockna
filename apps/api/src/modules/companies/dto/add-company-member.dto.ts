import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class AddCompanyMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['OWNER', 'ACCOUNTANT', 'EMPLOYEE'])
  role?: 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE';
}
