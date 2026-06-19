import { MembershipStatus } from "@platform/database";
import { IsEnum } from "class-validator";

export class UpdateMembershipStatusDto {
  @IsEnum(MembershipStatus)
  status!: MembershipStatus;
}
