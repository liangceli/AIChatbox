import { IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateManualKnowledgeDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceUri?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
