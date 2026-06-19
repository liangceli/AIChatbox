import { Module } from "@nestjs/common";
import { WidgetSessionController } from "./widget-session.controller";
import { WidgetSessionGuard } from "./widget-session.guard";
import { WidgetSessionService } from "./widget-session.service";

@Module({
  controllers: [WidgetSessionController],
  providers: [WidgetSessionService, WidgetSessionGuard],
  exports: [WidgetSessionService, WidgetSessionGuard]
})
export class WidgetSessionModule {}
