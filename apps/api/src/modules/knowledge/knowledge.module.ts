import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeRetrievalService } from "./knowledge-retrieval.service";
import { KnowledgeMetadataService } from "./knowledge-metadata.service";
import { KnowledgeService } from "./knowledge.service";
import { KnowledgeUrlImportService } from "./knowledge-url-import.service";
import { KnowledgeUrlSafetyService } from "./knowledge-url-safety.service";
import { KnowledgeTableImportService } from "./knowledge-table-import.service";
import { ConversationContextService } from "./conversation-context.service";
import { ConversationStateService } from "./conversation-state.service";
import { KnowledgeSemanticSearchService } from "./knowledge-semantic-search.service";

@Module({
  controllers: [KnowledgeController],
  providers: [
    AdminApiGuard,
    ConversationContextService,
    ConversationStateService,
    KnowledgeChunkingService,
    KnowledgeMetadataService,
    KnowledgeRetrievalService,
    KnowledgeSemanticSearchService,
    KnowledgeTableImportService,
    KnowledgeUrlSafetyService,
    KnowledgeUrlImportService,
    KnowledgeService
  ],
  exports: [
    ConversationContextService,
    ConversationStateService,
    KnowledgeMetadataService,
    KnowledgeRetrievalService,
    KnowledgeSemanticSearchService
  ]
})
export class KnowledgeModule {}
