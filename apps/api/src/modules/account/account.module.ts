import { Module } from "@nestjs/common";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";

@Module({
  controllers: [AccountController],
  providers: [AccountService, AdminApiGuard]
})
export class AccountModule {}
