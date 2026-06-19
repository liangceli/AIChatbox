import { IsString, MinLength } from "class-validator";

export class AcceptInvitationDto {
  @IsString()
  @MinLength(32)
  token!: string;
}
