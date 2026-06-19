import type { ConversationDetail, ConversationListItem } from "@platform/types";
import { Controller, Inject, MessageEvent, Query, Sse, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { CurrentAdminAuth } from "../../common/admin-protection/current-admin-auth.decorator";
import { Observable, from, interval, map, startWith, switchMap } from "rxjs";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { RealtimeService } from "./realtime.service";
import { CurrentWidgetSession } from "../widget-session/current-widget-session.decorator";
import { WidgetSessionGuard } from "../widget-session/widget-session.guard";
import type { WidgetSessionContext } from "../widget-session/widget-session.types";

interface RealtimeSnapshot {
  conversations: ConversationListItem[];
  pendingHumanCount: number;
  activeConversation?: ConversationDetail | null;
}

interface CustomerRealtimeSnapshot {
  conversation: ConversationDetail | null;
}

@Controller("realtime")
export class RealtimeController {
  constructor(@Inject(RealtimeService) private readonly realtimeService: RealtimeService) {}

  @Sse("conversations")
  @UseGuards(AdminApiGuard)
  streamConversations(
    @CurrentTenant() tenant: ResolvedTenant,
    @Query("status") status: string | undefined,
    @CurrentAdminAuth() adminAuth: AdminAuthContext
  ): Observable<MessageEvent> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.realtimeService.createSnapshot(tenant, status, adminAuth))),
      map((snapshot: RealtimeSnapshot) => ({
        type: "conversation_snapshot",
        data: snapshot
      }))
    );
  }

  @Sse("customer-conversation")
  @UseGuards(WidgetSessionGuard)
  streamCustomerConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @CurrentWidgetSession() session: WidgetSessionContext,
    @Query("conversationId") conversationId?: string
  ): Observable<MessageEvent> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() =>
        from(this.realtimeService.createCustomerSnapshot(tenant, conversationId, session.visitorId))
      ),
      map((snapshot: CustomerRealtimeSnapshot) => ({
        type: "customer_conversation_snapshot",
        data: snapshot
      }))
    );
  }
}
