import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  controllers: [ConversationsController],
  providers: [AdminApiGuard, ConversationsService],
  exports: [ConversationsService]
})
export class ConversationsModule {}
