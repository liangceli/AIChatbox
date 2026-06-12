import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { PublicTenantProfileController } from "./public-tenant-profile.controller";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

@Module({
  controllers: [TenantsController, PublicTenantProfileController],
  providers: [AdminApiGuard, TenantsService]
})
export class TenantsModule {}
