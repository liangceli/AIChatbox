import type { KnowledgeBaseRecord, KnowledgeDocumentRecord } from "@platform/types";
import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { CreateKnowledgeBaseDto } from "./dto/create-knowledge-base.dto";
import { CreateManualKnowledgeDocumentDto } from "./dto/create-manual-knowledge-document.dto";
import { KnowledgeService } from "./knowledge.service";

@Controller("knowledge-bases")
export class KnowledgeController {
  constructor(@Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async listKnowledgeBases(@CurrentTenant() tenant: ResolvedTenant): Promise<KnowledgeBaseRecord[]> {
    return this.knowledgeService.listKnowledgeBases(tenant);
  }

  @Post()
  async createKnowledgeBase(
    @CurrentTenant() tenant: ResolvedTenant,
    @Body() body: CreateKnowledgeBaseDto
  ): Promise<KnowledgeBaseRecord> {
    return this.knowledgeService.createKnowledgeBase(tenant, body);
  }

  @Get(":knowledgeBaseId")
  async getKnowledgeBase(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string
  ): Promise<KnowledgeBaseRecord> {
    return this.knowledgeService.getKnowledgeBase(tenant, knowledgeBaseId);
  }

  @Get(":knowledgeBaseId/documents")
  async listKnowledgeDocuments(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string
  ): Promise<KnowledgeDocumentRecord[]> {
    return this.knowledgeService.listKnowledgeDocuments(tenant, knowledgeBaseId);
  }

  @Post(":knowledgeBaseId/documents")
  async createManualDocument(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Body() body: CreateManualKnowledgeDocumentDto
  ): Promise<KnowledgeDocumentRecord> {
    return this.knowledgeService.createManualDocument(tenant, knowledgeBaseId, body);
  }
}
