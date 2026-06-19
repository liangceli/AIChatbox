import { IsOptional, IsString, MinLength } from "class-validator";

export class BootstrapWidgetSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(32)
  sessionToken?: string;
}
