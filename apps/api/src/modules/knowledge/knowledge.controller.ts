import type {
  KnowledgeBaseRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRecord,
  ImportUrlKnowledgeDocumentResult
} from "@platform/types";
import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { CreateKnowledgeBaseDto } from "./dto/create-knowledge-base.dto";
import { CreateManualKnowledgeDocumentDto } from "./dto/create-manual-knowledge-document.dto";
import { ImportUrlsKnowledgeDocumentDto } from "./dto/import-urls-knowledge-document.dto";
import { ImportUrlKnowledgeDocumentDto } from "./dto/import-url-knowledge-document.dto";
import { ReprocessKnowledgeDocumentDto } from "./dto/reprocess-knowledge-document.dto";
import { KnowledgeService } from "./knowledge.service";

@Controller("knowledge-bases")
@UseGuards(AdminApiGuard)
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

  @Post(":knowledgeBaseId/documents/import-url")
  async importUrlDocument(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Body() body: ImportUrlKnowledgeDocumentDto
  ): Promise<KnowledgeDocumentRecord> {
    return this.knowledgeService.importUrlDocument(tenant, knowledgeBaseId, body);
  }

  @Post(":knowledgeBaseId/documents/import-urls")
  async importUrlDocuments(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Body() body: ImportUrlsKnowledgeDocumentDto
  ): Promise<ImportUrlKnowledgeDocumentResult[]> {
    return this.knowledgeService.importUrlDocuments(tenant, knowledgeBaseId, body.urls);
  }

  @Get(":knowledgeBaseId/documents/:documentId")
  async getKnowledgeDocument(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Param("documentId") documentId: string
  ): Promise<KnowledgeDocumentDetail> {
    return this.knowledgeService.getKnowledgeDocument(tenant, knowledgeBaseId, documentId);
  }

  @Get(":knowledgeBaseId/documents/:documentId/chunks")
  async listKnowledgeDocumentChunks(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Param("documentId") documentId: string
  ): Promise<KnowledgeChunkRecord[]> {
    return this.knowledgeService.listKnowledgeDocumentChunks(tenant, knowledgeBaseId, documentId);
  }

  @Post(":knowledgeBaseId/documents/:documentId/reprocess")
  async reprocessKnowledgeDocument(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Param("documentId") documentId: string,
    @Body() body: ReprocessKnowledgeDocumentDto
  ): Promise<KnowledgeDocumentDetail> {
    return this.knowledgeService.reprocessKnowledgeDocument(
      tenant,
      knowledgeBaseId,
      documentId,
      body.content
    );
  }

  @Post(":knowledgeBaseId/documents/:documentId/archive")
  async archiveKnowledgeDocument(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Param("documentId") documentId: string
  ): Promise<KnowledgeDocumentRecord> {
    return this.knowledgeService.archiveKnowledgeDocument(tenant, knowledgeBaseId, documentId);
  }

  @Delete(":knowledgeBaseId/documents/:documentId")
  async deleteKnowledgeDocument(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("knowledgeBaseId") knowledgeBaseId: string,
    @Param("documentId") documentId: string
  ): Promise<{ deleted: true }> {
    await this.knowledgeService.deleteKnowledgeDocument(tenant, knowledgeBaseId, documentId);
    return { deleted: true };
  }
}
