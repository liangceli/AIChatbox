import type { Request } from "express";

export interface WidgetSessionContext {
  tenantId: string;
  visitorId: string;
  expiresAt: number;
}

export interface WidgetAuthenticatedRequest extends Request {
  widgetSession?: WidgetSessionContext;
}
