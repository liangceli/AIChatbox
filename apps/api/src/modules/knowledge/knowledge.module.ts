import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeUrlImportService } from "./knowledge-url-import.service";
import { KnowledgeUrlSafetyService } from "./knowledge-url-safety.service";
import { KnowledgeTableImportService } from "./knowledge-table-import.service";

@Module({
  controllers: [KnowledgeController],
  providers: [
    AdminApiGuard,
    KnowledgeChunkingService,
    KnowledgeRetrievalService,
    KnowledgeTableImportService,
    KnowledgeUrlSafetyService,
    KnowledgeUrlImportService,
    KnowledgeService
  ],
  exports: [KnowledgeRetrievalService]
})
export class KnowledgeModule {}
