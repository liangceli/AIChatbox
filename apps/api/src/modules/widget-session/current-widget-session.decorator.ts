import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { WidgetAuthenticatedRequest, WidgetSessionContext } from "./widget-session.types";

export const CurrentWidgetSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WidgetSessionContext | undefined =>
    context.switchToHttp().getRequest<WidgetAuthenticatedRequest>().widgetSession
);
