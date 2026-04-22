import { Injectable } from "@nestjs/common";

interface ReplyInput {
  displayName: string;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  userMessage: string;
}

@Injectable()
export class AssistantReplyService {
  generateReply(input: ReplyInput): string {
    const normalizedMessage = input.userMessage.trim();

    if (!normalizedMessage) {
      return input.fallbackMessage ?? "I can help once you send a message.";
    }

    const greeting = input.welcomeMessage ?? "Thanks for reaching out.";

    return `${greeting} I’m ${input.displayName}. This local development reply confirms I received: "${normalizedMessage}".`;
  }
}
