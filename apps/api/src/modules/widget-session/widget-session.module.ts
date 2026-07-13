import { Module } from "@nestjs/common";
import { WidgetSessionController } from "./widget-session.controller";
import { WidgetSessionGuard } from "./widget-session.guard";
import { WidgetRateLimitGuard } from "./widget-rate-limit.guard";
import { WidgetSessionService } from "./widget-session.service";

@Module({
  controllers: [WidgetSessionController],
  providers: [WidgetSessionService, WidgetSessionGuard, WidgetRateLimitGuard],
  exports: [WidgetSessionService, WidgetSessionGuard, WidgetRateLimitGuard]
})
export class WidgetSessionModule {}
