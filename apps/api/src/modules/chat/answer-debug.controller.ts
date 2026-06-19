import type { AnswerDebugResult } from "@platform/types";
import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { RequireTenantRoles } from "../../common/admin-protection/access-policy.decorator";
import { TenantRole } from "@platform/database";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { AnswerDebugService } from "./answer-debug.service";
import { RunAnswerDebugDto } from "./dto/run-answer-debug.dto";

@Controller("chat/answer-debug")
@UseGuards(AdminApiGuard)
@RequireTenantRoles(TenantRole.OWNER)
export class AnswerDebugController {
  constructor(@Inject(AnswerDebugService) private readonly answerDebugService: AnswerDebugService) {}

  @Post()
  async run(
    @CurrentTenant() tenant: ResolvedTenant,
    @Body() body: RunAnswerDebugDto
  ): Promise<AnswerDebugResult> {
    return this.answerDebugService.run(tenant, body.question);
  }
}
