import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateHumanSupportDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
