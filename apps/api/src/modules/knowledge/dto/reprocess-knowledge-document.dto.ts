import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ReprocessKnowledgeDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content?: string;
}
