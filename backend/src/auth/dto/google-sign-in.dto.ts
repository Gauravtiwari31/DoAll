import { IsJWT, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleSignInDto {
  /** The ID token the app got from Google, issued to this server's client ID (GOOGLE_CLIENT_ID). */
  @IsJWT({ message: 'idToken must be a Google ID token' })
  idToken: string;

  /**
   * Only to connect Google to an existing email/password account with the
   * same address: that account's password, asked for once.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password?: string;
}
