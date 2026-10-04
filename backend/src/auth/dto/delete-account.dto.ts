import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteAccountDto {
  /** The current password, asked for again so an unlocked phone alone can't delete the account. */
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
