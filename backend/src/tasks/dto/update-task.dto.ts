import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

/** Every field is optional; only the provided ones are changed. */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class SetTaskStatusDto {
  @IsBoolean({ message: 'completed must be true or false' })
  completed: boolean;
}
