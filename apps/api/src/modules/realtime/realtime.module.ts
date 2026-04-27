import { Module } from "@nestjs/common";
import { ConversationsModule } from "../conversations/conversations.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [ConversationsModule],
  controllers: [RealtimeController],
  providers: [RealtimeService]
})
export class RealtimeModule {}
