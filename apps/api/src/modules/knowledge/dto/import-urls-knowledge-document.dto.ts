import { ArrayMaxSize, ArrayMinSize, IsArray, IsUrl } from "class-validator";

export class ImportUrlsKnowledgeDocumentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUrl(
    {
      require_protocol: true,
      protocols: ["http", "https"]
    },
    { each: true }
  )
  urls!: string[];
}
