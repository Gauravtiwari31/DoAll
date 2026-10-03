import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

/** Rejects malformed ids with a 400 before they ever reach a Mongo query. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`"${value}" is not a valid id`);
    }
    return value;
  }
}
