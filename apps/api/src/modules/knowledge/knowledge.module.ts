import { Module } from "@nestjs/common";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { KnowledgeService } from "./knowledge.service";

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeChunkingService, KnowledgeRetrievalService, KnowledgeService],
  exports: [KnowledgeRetrievalService]
})
export class KnowledgeModule {}
