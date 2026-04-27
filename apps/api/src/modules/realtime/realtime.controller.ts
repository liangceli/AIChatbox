import type { ConversationDetail, ConversationListItem } from "@platform/types";
import { Controller, Inject, MessageEvent, Query, Sse } from "@nestjs/common";
import { Observable, from, interval, map, startWith, switchMap } from "rxjs";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { RealtimeService } from "./realtime.service";

interface RealtimeSnapshot {
  conversations: ConversationListItem[];
  pendingHumanCount: number;
  activeConversation?: ConversationDetail | null;
}

@Controller("realtime")
export class RealtimeController {
  constructor(@Inject(RealtimeService) private readonly realtimeService: RealtimeService) {}

  @Sse("conversations")
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
}
