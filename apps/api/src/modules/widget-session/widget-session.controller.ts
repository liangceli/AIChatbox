import { Body, Controller, Inject, Post } from "@nestjs/common";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { BootstrapWidgetSessionDto } from "./dto/bootstrap-widget-session.dto";
import { WidgetSessionService } from "./widget-session.service";

@Controller("widget")
export class WidgetSessionController {
  constructor(@Inject(WidgetSessionService) private readonly sessions: WidgetSessionService) {}

  @Post("session")
  createSession(@CurrentTenant() tenant: ResolvedTenant, @Body() body: BootstrapWidgetSessionDto) {
    return this.sessions.issue(tenant, body.sessionToken);
  }
}
