import { Type } from "class-transformer";
import { IsInt, IsString, Length, Max, Min } from "class-validator";

export class SearchResourcesQueryDto {
  @IsString()
  @Length(2, 100)
  q!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit = 6;
}
