import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { ConversationsModule } from "../conversations/conversations.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [ConversationsModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, AdminApiGuard]
})
export class RealtimeModule {}
