import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  controllers: [SearchController],
  providers: [AdminApiGuard, SearchService]
})
export class SearchModule {}
