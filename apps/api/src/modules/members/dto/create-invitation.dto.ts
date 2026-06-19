import { TenantRole } from "@platform/database";
import { IsEmail, IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(TenantRole)
  role!: TenantRole;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}
