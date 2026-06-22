import { IsString, Matches, MaxLength } from "class-validator";

export class UpdateAccountAvatarDto {
  @IsString()
  @MaxLength(750_000)
  @Matches(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  avatarDataUrl!: string;
}
