import { IsOptional, IsString, MaxLength } from "class-validator";

export class RequestHandoffDto {
  @IsOptional()
  @IsString()
  visitorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
