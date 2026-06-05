import type { ConversationDetail, ConversationListItem } from "@platform/types";
import { Controller, Inject, MessageEvent, Query, Sse, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { Observable, from, interval, map, startWith, switchMap } from "rxjs";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { RealtimeService } from "./realtime.service";

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
    @Query("status") status?: string
  ): Observable<MessageEvent> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.realtimeService.createSnapshot(tenant, status))),
      map((snapshot: RealtimeSnapshot) => ({
        type: "conversation_snapshot",
        data: snapshot
      }))
    );
  }

  @Sse("customer-conversation")
  streamCustomerConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Query("conversationId") conversationId?: string,
    @Query("visitorId") visitorId?: string
  ): Observable<MessageEvent> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() =>
        from(this.realtimeService.createCustomerSnapshot(tenant, conversationId, visitorId))
      ),
      map((snapshot: CustomerRealtimeSnapshot) => ({
        type: "customer_conversation_snapshot",
        data: snapshot
      }))
    );
  }
}
