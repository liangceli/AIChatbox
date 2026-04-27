import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class ImportUrlKnowledgeDocumentDto {
  @IsUrl({
    require_protocol: true,
    protocols: ["http", "https"]
  })
  @MaxLength(1000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
