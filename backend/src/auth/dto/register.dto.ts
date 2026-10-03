import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  /** Display name shown in the app greeting. */
  @Transform(trim)
  @IsString()
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters' })
  name: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  /** 8+ characters with at least one letter and one number. */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be at most 72 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;
}
