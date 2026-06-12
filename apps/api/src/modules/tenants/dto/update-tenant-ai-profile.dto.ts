import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationOptions
} from "class-validator";

const MAX_PROFILE_IMAGE_SOURCE_LENGTH = 1_400_000;
const PROFILE_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\r\n]+$/;

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function IsProfileImageSource(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isProfileImageSource",
      target: object.constructor,
      propertyName,
      options: {
        message:
          "$property must be an http(s) URL or an uploaded PNG, JPEG, WebP, or GIF image under 1 MB.",
        ...validationOptions
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string" || value.length > MAX_PROFILE_IMAGE_SOURCE_LENGTH) {
            return false;
          }

          if (PROFILE_IMAGE_DATA_URL_PATTERN.test(value)) {
            return true;
          }

          try {
            const url = new URL(value);

            return (
              value.length <= 1000 &&
              (url.protocol === "http:" || url.protocol === "https:")
            );
          } catch {
            return false;
          }
        }
      }
    });
  };
}

export class UpdateTenantAiProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(({ value }) => trimOptionalString(value))
  assistantName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(({ value }) => trimOptionalString(value))
  companyDisplayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(({ value }) => trimOptionalString(value))
  businessType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Transform(({ value }) => trimOptionalString(value))
  tone?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }) => trimOptionalString(value))
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }) => trimOptionalString(value))
  fallbackMessage?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Transform(({ value }) => trimOptionalString(value))
  handoffMessage?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }) => trimOptionalString(value))
  safeAnswerInstructions?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }) => trimOptionalString(value))
  sensitiveTopicInstructions?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }) => trimOptionalString(value))
  doNotAnswerInstructions?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  @Transform(({ value }) => trimOptionalString(value))
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @IsProfileImageSource()
  @Transform(({ value }) => trimOptionalString(value))
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @IsProfileImageSource()
  @Transform(({ value }) => trimOptionalString(value))
  avatarUrl?: string | null;
}
