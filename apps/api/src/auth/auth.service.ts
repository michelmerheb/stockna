import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/modules/users/users.service';
import { PasswordService } from 'src/common/crypto/password.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@stockna/database';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLocaleLowerCase();
  }

  async register(data: { email: string; password: string; name?: string }) {
    const email = this.normalizeEmail(data.email);
    const { password, name } = data;

    // 1) Check duplicate
    const existing = await this.usersService.findAuthByEmail(email);

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // 2) Hash password
    const passwordHash = await this.passwordService.hash(password);

    let user: { id: string; email: string; name: string | null };

    // 3) Create user
    try {
      user = await this.usersService.createUser({
        email,
        passwordHash,
        name,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Email already in use');
        }
      }
      throw err;
    }

    // 4) Sign Token
    const payload = { sub: user.id };
    const accessToken = await this.jwtService.signAsync(payload);

    // 5) Return safe response
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersService.findAuthByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const ok = await this.passwordService.verify(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    // JWT payload: minimal for now
    const payload = { sub: user.id };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}
