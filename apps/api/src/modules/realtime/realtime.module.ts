import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { ConversationsModule } from "../conversations/conversations.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";
import { WidgetSessionModule } from "../widget-session/widget-session.module";

@Module({
  imports: [ConversationsModule, WidgetSessionModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, AdminApiGuard]
})
export class RealtimeModule {}
