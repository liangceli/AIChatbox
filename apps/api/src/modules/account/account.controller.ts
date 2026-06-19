import type { AccountRecord } from "@platform/types";
import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AllowAuthenticatedClerk } from "../../common/admin-protection/access-policy.decorator";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { CurrentAdminAuth } from "../../common/admin-protection/current-admin-auth.decorator";
import { AccountService } from "./account.service";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";

@Controller("account")
@UseGuards(AdminApiGuard)
@AllowAuthenticatedClerk()
export class AccountController {
  constructor(@Inject(AccountService) private readonly accountService: AccountService) {}

  @Get("me")
  getMe(@CurrentAdminAuth() auth: AdminAuthContext): Promise<AccountRecord> {
    return this.accountService.getMe(auth);
  }

  @Post("accept-invitation")
  acceptInvitation(
    @CurrentAdminAuth() auth: AdminAuthContext,
    @Body() body: AcceptInvitationDto
  ): Promise<AccountRecord> {
    return this.accountService.acceptInvitation(auth, body.token);
  }
}
