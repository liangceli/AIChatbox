import { IsString, MaxLength, MinLength } from "class-validator";

export class SendAgentReplyDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
