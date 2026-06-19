import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma/prisma.module";
import { ChatModule } from "./modules/chat/chat.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { HealthModule } from "./modules/health/health.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { SearchModule } from "./modules/search/search.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { AccountModule } from "./modules/account/account.module";
import { MembersModule } from "./modules/members/members.module";
import { WidgetSessionModule } from "./modules/widget-session/widget-session.module";

@Module({
  imports: [
    PrismaModule,
    AccountModule,
    MembersModule,
    WidgetSessionModule,
    HealthModule,
    TenantsModule,
    KnowledgeModule,
    ChatModule,
    ConversationsModule,
    SearchModule,
    RealtimeModule
  ]
})
export class AppModule {}
