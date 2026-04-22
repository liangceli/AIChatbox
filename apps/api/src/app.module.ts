import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ChatModule } from "./modules/chat/chat.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [PrismaModule, HealthModule, ChatModule, ConversationsModule]
})
export class AppModule {}
