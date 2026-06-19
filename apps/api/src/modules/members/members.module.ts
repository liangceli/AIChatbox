import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";

@Module({
  controllers: [MembersController],
  providers: [MembersService, AdminApiGuard]
})
export class MembersModule {}
