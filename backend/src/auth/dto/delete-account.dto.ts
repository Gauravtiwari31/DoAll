import { IsJWT, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * The user confirms who they are again, so an unlocked phone alone can't
 * delete the account: with the password, or for an account that signs in with
 * Google, by choosing that Google account again.
 */
export class DeleteAccountDto {
  /** The current password. Required unless `googleIdToken` is sent. */
  @ValidateIf((dto: DeleteAccountDto) => dto.googleIdToken === undefined)
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password?: string;

  /** A fresh Google ID token for the Google account connected to this account. */
  @IsOptional()
  @IsJWT({ message: 'googleIdToken must be a Google ID token' })
  googleIdToken?: string;
}
