import type { TenantOverviewRecord } from "@platform/types";
import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenantsService: TenantsService) {}

  @Get()
  async listTenants(): Promise<TenantOverviewRecord[]> {
    return this.tenantsService.listTenants();
  }

  @Post()
  async createTenant(@Body() body: CreateTenantDto): Promise<TenantOverviewRecord> {
    return this.tenantsService.createTenant(body);
  }
}
