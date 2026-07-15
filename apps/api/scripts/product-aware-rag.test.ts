import assert from "node:assert/strict";
import { KnowledgeMetadataService } from "../src/modules/knowledge/knowledge-metadata.service";
import { KnowledgeRetrievalService } from "../src/modules/knowledge/knowledge-retrieval.service";
import { ConversationContextService } from "../src/modules/knowledge/conversation-context.service";

type Candidate = {
  id: string;
  content: string;
  chunkIndex: number;
  sourceLocator?: unknown;
  metadata?: Record<string, unknown> | null;
  knowledgeDocument: {
    id: string;
    title: string;
    sourceUri?: string | null;
    metadata?: Record<string, unknown> | null;
  };
};

const tenant = {
  id: "tenant-product-aware",
  slug: "product-aware",
  name: "Product Aware",
  status: "ACTIVE"
} as never;

function createRetrievalService(candidates: Candidate[]): KnowledgeRetrievalService {
  return new KnowledgeRetrievalService(
    {
      client: {
        knowledgeChunk: {
          findMany: async (query: {
            where?: {
              OR?: Array<
                | { content?: { contains?: string } }
                | { knowledgeDocument?: { title?: { contains?: string } } }
              >;
            };
          }) => {
            const candidateTerms =
              query.where?.OR?.flatMap((condition) => [
                "content" in condition ? condition.content?.contains : undefined,
                "knowledgeDocument" in condition
                  ? condition.knowledgeDocument?.title?.contains
                  : undefined
              ]).filter((term): term is string => Boolean(term)) ?? [];

            if (candidateTerms.length === 0) {
              return candidates;
            }

            return candidates.filter((candidate) =>
              candidateTerms.some((term) => {
                const normalizedTerm = term.toLowerCase();

                return (
                  candidate.content.toLowerCase().includes(normalizedTerm) ||
                  candidate.knowledgeDocument.title.toLowerCase().includes(normalizedTerm)
                );
              })
            );
          }
        }
      }
    } as never,
    new KnowledgeMetadataService(),
    new ConversationContextService()
  );
}

function productCandidate(
  id: string,
  productName: string,
  content: string
): Candidate {
  const knowledge = {
    productName,
    aliases: [productName],
    intentHints: ["pairing"]
  };

  return {
    id: `${id}-chunk`,
    content,
    chunkIndex: 0,
    metadata: {
      knowledge
    },
    knowledgeDocument: {
      id,
      title: `${productName} FAQ`,
      sourceUri: `https://example.test/${id}`,
      metadata: {
        knowledge
      }
    }
  };
}

function productCandidateWithIntent(
  id: string,
  productName: string,
  intentHint: string,
  content: string
): Candidate {
  const knowledge = {
    productName,
    aliases: [productName],
    intentHints: [intentHint]
  };

  return {
    id: `${id}-chunk`,
    content,
    chunkIndex: 0,
    metadata: {
      knowledge
    },
    knowledgeDocument: {
      id,
      title: `${productName} ${intentHint}`,
      sourceUri: `https://example.test/${id}`,
      metadata: {
        knowledge
      }
    }
  };
}

function genericCandidate(id: string, title: string, content: string): Candidate {
  return {
    id: `${id}-chunk`,
    content,
    chunkIndex: 0,
    metadata: null,
    knowledgeDocument: {
      id,
      title,
      sourceUri: `https://example.test/${id}`,
      metadata: null
    }
  };
}

async function testShortProductActionAsksForClarification() {
  const service = createRetrievalService([
    productCandidate("matter-device", "Matter device", "Question: How are Matter devices paired?\nAnswer: Scan the Matter QR code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const decision = await service.resolveRetrievalDecision(tenant, "how to pair?");

  assert.equal(decision.mode, "clarification");
  assert.equal(decision.retrievedChunks.length, 0);
  assert.equal(decision.ambiguity.isAmbiguous, true);
  assert.equal(decision.ambiguity.intent, "pairing");
  assert.deepEqual(decision.ambiguity.options.sort(), ["Bluetooth remote", "Matter device"].sort());
  assert.match(decision.ambiguity.clarificationQuestion ?? "", /Which product/i);
}

async function testClarificationAnswerScopesRetrieval() {
  const service = createRetrievalService([
    productCandidate("matter-device", "Matter device", "Question: How are Matter devices paired?\nAnswer: Scan the Matter QR code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how to pair?");
  const second = await service.resolveRetrievalDecision(tenant, "Matter device", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(second.mode, "answer");
  assert.equal(second.retrievedChunks.length, 1);
  assert.equal(second.retrievedChunks[0]?.title, "Matter device FAQ");
  assert.equal(second.productContext?.productName, "Matter device");
  assert.equal(second.pendingClarification, null);
}

async function testShortProductActionCreatesOpenClarificationForGenericEvidence() {
  const service = createRetrievalService([
    genericCandidate("matter-qa-1", "matter_qa.xlsx", "Question: How to pair?\nAnswer: Matter products use app-specific pairing steps."),
    genericCandidate("matter-qa-2", "matter_qa.xlsx", "Question: How are devices paired?\nAnswer: The product model determines the right setup code.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how to pair?");
  const second = await service.resolveRetrievalDecision(tenant, "matter product", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(first.mode, "clarification");
  assert.equal(first.retrievedChunks.length, 0);
  assert.equal(first.pendingClarification?.originalQuestion, "how to pair?");
  assert.equal(first.pendingClarification?.intent, "pairing");
  assert.deepEqual(first.pendingClarification?.options, []);
  assert.equal(second.mode, "clarification");
  assert.equal(second.retrievedChunks.length, 0);
  assert.equal(second.pendingClarification?.originalQuestion, "how to pair?");
}

async function testShortModelReplyResolvesPendingClarificationWithOriginalIntent() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the QR code or 11-digit setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how to pair?");
  const second = await service.resolveRetrievalDecision(tenant, "KMREN", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(second.mode, "answer");
  assert.match(second.effectiveQuestion, /how to pair\?.*KMREN/i);
  assert.equal(second.intent, "pairing");
  assert.equal(second.retrievedChunks.length, 1);
  assert.equal(second.retrievedChunks[0]?.title, "KMREM FAQ");
  assert.equal(second.productContext?.productName, "KMREM");
  assert.equal(second.pendingClarification, null);
}

async function testTransposedShortModelReplyResolvesPendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the QR code or 11-digit setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how do I pair a device?");
  const second = await service.resolveRetrievalDecision(tenant, "KMERM", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(first.mode, "clarification");
  assert.equal(second.mode, "answer");
  assert.match(second.effectiveQuestion, /how do I pair a device\?.*KMERM/i);
  assert.equal(second.intent, "pairing");
  assert.equal(second.retrievedChunks.length, 1);
  assert.equal(second.retrievedChunks[0]?.title, "KMREM FAQ");
  assert.equal(second.productContext?.productName, "KMREM");
  assert.equal(second.pendingClarification, null);
}

async function testMultipleModelCodeEditsDoNotResolvePendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the QR code or 11-digit setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how do I pair a device?");
  const second = await service.resolveRetrievalDecision(tenant, "KXREN", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(second.mode, "clarification");
  assert.equal(second.retrievedChunks.length, 0);
  assert.equal(second.productContext, null);
  assert.match(second.confidence.reason, /did not match/i);
}

async function testGreetingDoesNotConsumePendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the QR code or 11-digit setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how do I pair a device?");
  const greeting = await service.resolveRetrievalDecision(tenant, "Hi", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });
  const resumed = await service.resolveRetrievalDecision(tenant, "KMERM", {
    rag: {
      pendingClarification: greeting.pendingClarification
    }
  });

  assert.equal(greeting.mode, "answer");
  assert.equal(greeting.effectiveQuestion, "Hi");
  assert.equal(greeting.retrievedChunks.length, 0);
  assert.deepEqual(greeting.pendingClarification, first.pendingClarification);
  assert.equal(resumed.mode, "answer");
  assert.equal(resumed.retrievedChunks[0]?.title, "KMREM FAQ");
  assert.equal(resumed.productContext?.productName, "KMREM");
}

async function testSocialTurnSkipsRetrievalAndPreservesPendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the QR code in the app."),
    productCandidate("remote", "Bluetooth remote", "Question: How is the remote paired?\nAnswer: Hold two buttons.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how do I pair a device?");
  const social = await service.resolveRetrievalDecision(tenant, "How are you?", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(social.mode, "answer");
  assert.equal(social.turnType, "social");
  assert.equal(social.retrievedChunks.length, 0);
  assert.equal(social.retrievalMetadata.retrievalSkipped, true);
  assert.equal(social.retrievalMetadata.skipReason, "conversational_turn");
  assert.deepEqual(social.pendingClarification, first.pendingClarification);
}

async function testTenantRoutingPolicyExtendsConversationClassificationWithoutProductBranches() {
  const service = createRetrievalService([]);
  const decision = await service.resolveRetrievalDecision(
    tenant,
    "custom courtesy signal",
    undefined,
    3,
    {
      conversationRouting: {
        socialPhrases: ["custom courtesy signal"],
        responses: {
          social: "Configured conversational reply."
        }
      }
    }
  );

  assert.equal(decision.turnType, "social");
  assert.equal(decision.retrievalMetadata.retrievalSkipped, true);
  assert.equal(decision.conversationReply, "Configured conversational reply.");
}

async function testAcknowledgementPreservesPendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the QR code in the app."),
    productCandidate("remote", "Bluetooth remote", "Question: How is the remote paired?\nAnswer: Hold two buttons.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how do I pair a device?");
  const acknowledgement = await service.resolveRetrievalDecision(tenant, "Got it", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(acknowledgement.turnType, "acknowledgement");
  assert.equal(acknowledgement.retrievalMetadata.retrievalSkipped, true);
  assert.deepEqual(acknowledgement.pendingClarification, first.pendingClarification);
}

async function testShortModelReplyResolvesOpenPendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Device/Scope: KMREM\nQuestion: How is KMREM paired?\nAnswer: Use the QR code or 11-digit setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const decision = await service.resolveRetrievalDecision(tenant, "KMREN", {
    rag: {
      pendingClarification: {
        originalQuestion: "how to pair?",
        intent: "pairing",
        options: []
      }
    }
  });

  assert.equal(decision.mode, "answer");
  assert.match(decision.effectiveQuestion, /how to pair\?.*KMREN/i);
  assert.equal(decision.intent, "pairing");
  assert.equal(decision.retrievedChunks.length, 1);
  assert.equal(decision.retrievedChunks[0]?.title, "KMREM FAQ");
  assert.equal(decision.productContext?.productName, "KMREM");
}

async function testTransposedShortModelReplyResolvesOpenPendingClarification() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Device/Scope: KMREM\nQuestion: How is KMREM paired?\nAnswer: Use the QR code or 11-digit setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const decision = await service.resolveRetrievalDecision(tenant, "KMERM", {
    rag: {
      pendingClarification: {
        originalQuestion: "how do I pair a device?",
        intent: "pairing",
        options: []
      }
    }
  });

  assert.equal(decision.mode, "answer");
  assert.match(decision.effectiveQuestion, /how do I pair a device\?.*KMERM/i);
  assert.equal(decision.intent, "pairing");
  assert.equal(decision.retrievedChunks.length, 1);
  assert.equal(decision.retrievedChunks[0]?.title, "KMREM FAQ");
  assert.equal(decision.productContext?.productName, "KMREM");
}

async function testConversationProductContextScopesShortFollowup() {
  const service = createRetrievalService([
    productCandidate("matter-device", "Matter device", "Question: How are Matter devices paired?\nAnswer: Scan the Matter QR code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back for five seconds.")
  ]);
  const decision = await service.resolveRetrievalDecision(tenant, "how to pair?", {
    rag: {
      productContext: {
        productName: "Bluetooth remote",
        aliases: ["Bluetooth remote"]
      }
    }
  });

  assert.equal(decision.mode, "answer");
  assert.equal(decision.ambiguity.isAmbiguous, false);
  assert.equal(decision.retrievedChunks.length, 1);
  assert.equal(decision.retrievedChunks[0]?.title, "Bluetooth remote FAQ");
}

async function testResolvedProductContextScopesPronounFollowup() {
  const service = createRetrievalService([
    productCandidateWithIntent(
      "kmdim-pair",
      "KMDIM400",
      "pairing",
      "Device/Scope: KMDIM400\nQuestion: How do I pair KMDIM400?\nAnswer: Put KMDIM400 into setup mode."
    ),
    productCandidateWithIntent(
      "kmdim-ecosystems",
      "KMDIM400",
      "compatibility",
      "Device/Scope: KMDIM400\nQuestion: Which ecosystems support KMDIM400?\nAnswer: KMDIM400 supports Apple Home and Google Home."
    ),
    productCandidateWithIntent(
      "kmrem-ecosystems",
      "KMREM",
      "compatibility",
      "Device/Scope: KMREM\nQuestion: Which ecosystems support KMREM?\nAnswer: KMREM supports Alexa, Apple Home, Google Home, and SmartThings."
    )
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how do I pair a device?");
  const selectedProduct = await service.resolveRetrievalDecision(tenant, "KMDIM400", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });
  const followUp = await service.resolveRetrievalDecision(tenant, "Which ecosystems support it?", {
    rag: {
      productContext: selectedProduct.productContext
    }
  });

  assert.equal(selectedProduct.mode, "answer");
  assert.equal(selectedProduct.productContext?.productName, "KMDIM400");
  assert.equal(followUp.mode, "answer");
  assert.equal(followUp.productContext?.productName, "KMDIM400");
  assert.equal(followUp.retrievedChunks[0]?.title, "KMDIM400 compatibility");
  assert.ok(!followUp.retrievedChunks.some((chunk) => chunk.title.includes("KMREM")));
}

async function testNoisyDocumentTitlesAreNotClarificationOptions() {
  const noisyKnowledge = { productName: "FAQ KASTA", aliases: ["FAQ KASTA"], intentHints: ["pairing"] };
  const caseStudyKnowledge = {
    productName: "HIGHGATE HILL TERRACES BRISBANE KASTA",
    aliases: ["HIGHGATE HILL TERRACES BRISBANE KASTA"],
    intentHints: ["pairing"]
  };
  const service = createRetrievalService([
    {
      id: "faq-kasta-chunk",
      content: "Question: How to pair?\nAnswer: This generic FAQ mentions pairing.",
      chunkIndex: 0,
      metadata: { knowledge: noisyKnowledge },
      knowledgeDocument: {
        id: "faq-kasta",
        title: "FAQ KASTA",
        metadata: { knowledge: noisyKnowledge }
      }
    },
    {
      id: "case-study-chunk",
      content: "A case study page mentions pairing and setup in passing.",
      chunkIndex: 0,
      metadata: { knowledge: caseStudyKnowledge },
      knowledgeDocument: {
        id: "case-study",
        title: "HIGHGATE HILL TERRACES BRISBANE KASTA",
        sourceUri: "https://example.test/case-studies/highgate",
        metadata: { knowledge: caseStudyKnowledge }
      }
    },
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back.")
  ]);
  const decision = await service.resolveRetrievalDecision(tenant, "how to pair?");

  assert.equal(decision.mode, "clarification");
  assert.deepEqual(decision.ambiguity.options.sort(), ["Bluetooth remote", "KMREM"].sort());
  assert.ok(!decision.ambiguity.options.includes("FAQ KASTA"));
  assert.ok(!decision.ambiguity.options.includes("HIGHGATE HILL TERRACES BRISBANE KASTA"));
}

async function testUnmatchedPendingClarificationRepeatsInsteadOfAnswering() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the setup code in the app."),
    productCandidate("bluetooth-remote", "Bluetooth remote", "Question: How is the Bluetooth remote paired?\nAnswer: Hold Home and Back.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how to pair?");
  const second = await service.resolveRetrievalDecision(tenant, "matter product", {
    rag: {
      pendingClarification: first.pendingClarification
    }
  });

  assert.equal(second.mode, "clarification");
  assert.equal(second.retrievedChunks.length, 0);
  assert.deepEqual(second.ambiguity.options.sort(), ["Bluetooth remote", "KMREM"].sort());
  assert.match(second.confidence.reason, /did not match/i);
}

async function testHybridRetrievalCombinesKeywordVectorAndTopKDiagnostics() {
  const service = createRetrievalService([
    genericCandidate(
      "exterior-rating",
      "Exterior installation guide",
      "This fixture is weatherproof and approved for exterior installation in exposed areas."
    ),
    ...Array.from({ length: 5 }, (_, index) =>
      genericCandidate(
        `unrelated-${index}`,
        `Internal policy ${index}`,
        `Administrative process ${index} for staff records and office procedures.`
      )
    )
  ]);

  const decision = await service.resolveRetrievalDecision(
    tenant,
    "Can this be used outside?",
    undefined,
    3
  );

  assert.equal(decision.mode, "answer");
  assert.equal(decision.retrievedChunks[0]?.chunkId, "exterior-rating-chunk");
  assert.equal(decision.retrievalMetadata.retrievalMode, "HYBRID");
  assert.ok(decision.retrievalMetadata.keywordCandidateChunkIds.includes("exterior-rating-chunk"));
  assert.ok(decision.retrievalMetadata.vectorCandidateChunkIds.includes("exterior-rating-chunk"));
  assert.deepEqual(decision.retrievalMetadata.selectedChunkIds, ["exterior-rating-chunk"]);
  assert.equal(decision.retrievalMetadata.finalTopK, 3);
  assert.ok((decision.retrievalMetadata.scores[0]?.finalScore ?? 0) >= 0.55);
}

async function testHybridRetrievalRejectsUnrelatedEvidence() {
  const service = createRetrievalService([
    genericCandidate(
      "exterior-rating",
      "Exterior installation guide",
      "This fixture is weatherproof and approved for exterior installation."
    )
  ]);

  const decision = await service.resolveRetrievalDecision(
    tenant,
    "What is the employee payroll tax rate?"
  );

  assert.equal(decision.mode, "answer");
  assert.equal(decision.retrievedChunks.length, 0);
  assert.equal(decision.retrievalMetadata.noKnowledgeEvidence, true);
  assert.equal(decision.retrievalMetadata.selectedChunkIds.length, 0);
}

async function testRepairIsTroubleshootingAndNeverPairing() {
  const troubleshootingCandidate = (id: string, productName: string): Candidate => {
    const knowledge = {
      productName,
      aliases: [productName],
      intentHints: ["troubleshooting"]
    };

    return {
      id: `${id}-chunk`,
      content: `Product: ${productName}\nQuestion: How can this product be repaired?\nAnswer: Contact support for verified service instructions.`,
      chunkIndex: 0,
      metadata: { knowledge },
      knowledgeDocument: {
        id,
        title: `${productName} service guide`,
        sourceUri: `https://example.test/${id}`,
        metadata: { knowledge }
      }
    };
  };
  const service = createRetrievalService([
    troubleshootingCandidate("kmrem-repair", "KMREM"),
    troubleshootingCandidate("kmdim-repair", "KMDIM400")
  ]);

  const decision = await service.resolveRetrievalDecision(tenant, "how to repair it?");

  assert.equal(decision.mode, "clarification");
  assert.equal(decision.intent, "troubleshooting");
  assert.match(decision.ambiguity.clarificationQuestion ?? "", /troubleshoot/i);
  assert.doesNotMatch(decision.ambiguity.clarificationQuestion ?? "", /trying to pair/i);
}

async function testRepairClarificationTypoExitsPendingStateSafely() {
  const service = createRetrievalService([
    productCandidate("kmrem", "KMREM", "Question: How is KMREM paired?\nAnswer: Use the setup code."),
    productCandidate("kmdim", "KMDIM400", "Question: How is KMDIM400 paired?\nAnswer: Use setup mode.")
  ]);
  const first = await service.resolveRetrievalDecision(tenant, "how to repair it?");
  const second = await service.resolveRetrievalDecision(tenant, "KMERM", {
    rag: { pendingClarification: first.pendingClarification }
  });

  assert.equal(first.mode, "clarification");
  assert.equal(first.intent, "troubleshooting");
  assert.ok(first.ambiguity.options.includes("KMREM"));
  assert.equal(second.mode, "answer");
  assert.equal(second.intent, "troubleshooting");
  assert.equal(second.pendingClarification, null);
  assert.equal(second.productContext?.productName, "KMREM");
  assert.equal(second.retrievedChunks.length, 0);
}

async function testChunkDeviceScopesOverrideSharedDocumentLabel() {
  const sharedDocumentKnowledge = {
    productName: "matter_thread_devices",
    aliases: ["matter_thread_devices.xlsx"],
    intentHints: ["pairing"]
  };
  const sharedDocument = {
    title: "matter_thread_devices.xlsx",
    sourceUri: "https://example.test/matter-thread-devices",
    metadata: { knowledge: sharedDocumentKnowledge }
  };
  const service = createRetrievalService([
    {
      id: "kmrem-shared-document-chunk",
      content: "Question: How is KMREM paired?\nAnswer: Use the QR code.\nDevice/Scope: KMREM",
      chunkIndex: 0,
      metadata: null,
      knowledgeDocument: { id: "shared-document", ...sharedDocument }
    },
    {
      id: "kmdim-shared-document-chunk",
      content: "Question: How is KMDIM400 paired?\nAnswer: Use setup mode.\nDevice/Scope: KMDIM400",
      chunkIndex: 1,
      metadata: null,
      knowledgeDocument: { id: "shared-document", ...sharedDocument }
    },
    {
      id: "generic-shared-document-chunk",
      content: "Question: How are devices paired?\nAnswer: Follow the instructions for the selected model.",
      chunkIndex: 2,
      metadata: null,
      knowledgeDocument: { id: "shared-document", ...sharedDocument }
    }
  ]);

  const decision = await service.resolveRetrievalDecision(tenant, "how to pair?");

  assert.equal(decision.mode, "clarification");
  assert.deepEqual(new Set(decision.ambiguity.options), new Set(["KMREM", "KMDIM400"]));
}

function testMetadataExtractionUsesExplicitFields() {
  const service = new KnowledgeMetadataService();
  const metadata = service.buildDocumentMetadata({
    title: "support.xlsx",
    content: [
      "Product Series: Lock Pro",
      "Model Number: LP-100",
      "Question: How do I reset the device?",
      "Answer: Hold the reset button for ten seconds."
    ].join("\n")
  });
  const chunkMetadata = service.buildChunkMetadata({
    documentMetadata: metadata,
    content: "Device/Scope: General\nQuestion: How do I reset the device?\nAnswer: Hold the reset button for ten seconds."
  });

  assert.equal(metadata.productSeries, "Lock Pro");
  assert.equal(metadata.modelNumber, "LP-100");
  assert.ok(metadata.intentHints?.includes("reset"));
  assert.equal(chunkMetadata.productSeries, "Lock Pro");
  assert.equal(chunkMetadata.deviceType, undefined);
  assert.equal(
    service.buildDocumentMetadata({
      title: "matter_qa.xlsx",
      content: "Question: How do I pair?\nAnswer: Scan the code."
    }).productName,
    undefined
  );
  assert.deepEqual(service.buildProductLabels({ productName: "FAQ KASTA", aliases: ["FAQ KASTA"] }), []);
  assert.deepEqual(
    service.buildProductLabels({ productName: "matter_qa.xlsx", aliases: ["matter_qa.xlsx"] }),
    []
  );
  assert.deepEqual(
    service.buildProductLabels({
      productName: "HIGHGATE HILL TERRACES BRISBANE KASTA",
      aliases: ["HIGHGATE HILL TERRACES BRISBANE KASTA"]
    }),
    []
  );
}

async function run() {
  await testShortProductActionAsksForClarification();
  await testClarificationAnswerScopesRetrieval();
  await testShortProductActionCreatesOpenClarificationForGenericEvidence();
  await testShortModelReplyResolvesPendingClarificationWithOriginalIntent();
  await testTransposedShortModelReplyResolvesPendingClarification();
  await testMultipleModelCodeEditsDoNotResolvePendingClarification();
  await testGreetingDoesNotConsumePendingClarification();
  await testSocialTurnSkipsRetrievalAndPreservesPendingClarification();
  await testTenantRoutingPolicyExtendsConversationClassificationWithoutProductBranches();
  await testAcknowledgementPreservesPendingClarification();
  await testShortModelReplyResolvesOpenPendingClarification();
  await testTransposedShortModelReplyResolvesOpenPendingClarification();
  await testConversationProductContextScopesShortFollowup();
  await testResolvedProductContextScopesPronounFollowup();
  await testNoisyDocumentTitlesAreNotClarificationOptions();
  await testUnmatchedPendingClarificationRepeatsInsteadOfAnswering();
  await testHybridRetrievalCombinesKeywordVectorAndTopKDiagnostics();
  await testHybridRetrievalRejectsUnrelatedEvidence();
  await testRepairIsTroubleshootingAndNeverPairing();
  await testRepairClarificationTypoExitsPendingStateSafely();
  await testChunkDeviceScopesOverrideSharedDocumentLabel();
  testMetadataExtractionUsesExplicitFields();
}

void run();
