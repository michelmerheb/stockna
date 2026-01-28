import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtPayload = { sub: string; companyId?: string };

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const extractJwt = ExtractJwt as {
      fromAuthHeaderAsBearerToken: () => (req: unknown) => string | null;
    };

    super({
      jwtFromRequest: extractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, companyId: payload.companyId ?? null };
  }
}
