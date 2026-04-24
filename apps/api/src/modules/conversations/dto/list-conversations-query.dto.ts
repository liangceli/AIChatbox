import { IsOptional, IsString } from "class-validator";

export class ListConversationsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
