import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { KnowledgeService } from "./knowledge.service";

@Module({
  controllers: [KnowledgeController],
  providers: [AdminApiGuard, KnowledgeChunkingService, KnowledgeRetrievalService, KnowledgeService],
  exports: [KnowledgeRetrievalService]
})
export class KnowledgeModule {}
