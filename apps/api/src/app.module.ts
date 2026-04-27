import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ChatModule } from "./modules/chat/chat.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { HealthModule } from "./modules/health/health.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { TenantsModule } from "./modules/tenants/tenants.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    TenantsModule,
    KnowledgeModule,
    ChatModule,
    ConversationsModule,
    RealtimeModule
  ]
})
export class AppModule {}
