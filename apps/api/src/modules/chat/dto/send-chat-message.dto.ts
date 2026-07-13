import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class SendChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsUUID()
  clientMessageId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  visitorId?: string;
}
