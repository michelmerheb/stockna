import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from 'src/modules/users/users.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';

type AuthRequest = Request & { user?: { userId: string } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAccessGuard)
  @Get('me')
  async me(@Req() req: AuthRequest) {
    const userId = req.user!.userId;
    console.log(req.user);
    const user = await this.usersService.findPublicById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    // return safe fields only
    return user;
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
