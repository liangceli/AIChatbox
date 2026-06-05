import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestHandoffDto {
  @IsString()
  @IsNotEmpty()
  visitorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
