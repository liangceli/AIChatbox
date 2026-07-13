import { ConversationStatus, type Prisma } from "@platform/database";

export const HUMAN_SUPPORT_STATUSES = [
  ConversationStatus.PENDING_HUMAN,
  ConversationStatus.ASSIGNED
] as const;

export function isHumanSupportActive(status: ConversationStatus): boolean {
  return HUMAN_SUPPORT_STATUSES.includes(
    status as (typeof HUMAN_SUPPORT_STATUSES)[number]
  );
}

export function humanSupportStatusWhere(): Prisma.EnumConversationStatusFilter {
  return {
    in: [...HUMAN_SUPPORT_STATUSES]
  };
}
