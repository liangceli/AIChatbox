import { IsInt, Max, Min } from "class-validator";

export class UpdateAgentInvitationQuotaDto {
  @IsInt()
  @Min(0)
  @Max(5)
  quota!: number;
}
