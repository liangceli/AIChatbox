import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { WidgetSessionModule } from "../widget-session/widget-session.module";

@Module({
  imports: [WidgetSessionModule],
  controllers: [ConversationsController],
  providers: [AdminApiGuard, ConversationsService],
  exports: [ConversationsService]
})
export class ConversationsModule {}
