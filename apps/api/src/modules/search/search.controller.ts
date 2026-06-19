import type { AdminSearchResponse } from "@platform/types";
import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { RequireTenantRoles } from "../../common/admin-protection/access-policy.decorator";
import { TenantRole } from "@platform/database";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { SearchResourcesQueryDto } from "./dto/search-resources-query.dto";
import { SearchService } from "./search.service";

@Controller("search")
@UseGuards(AdminApiGuard)
@RequireTenantRoles(TenantRole.OWNER)
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  async search(
    @CurrentTenant() tenant: ResolvedTenant,
    @Query() query: SearchResourcesQueryDto
  ): Promise<AdminSearchResponse> {
    return this.searchService.search(tenant, query.q, query.limit);
  }
}
