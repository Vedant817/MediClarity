export const aiModelConfig = {
  summaryModel: process.env.GEMINI_SUMMARY_MODEL ?? "gemini-1.5-pro",
  chatModel: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash",
  translationModel: process.env.GEMINI_TRANSLATION_MODEL ?? "gemini-1.5-pro",
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-exp-03-07",
  ocrModel: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest",
  retrievalTopK: Number(process.env.RAG_TOP_K ?? 5),
  retrievalCandidateK: Number(process.env.RAG_CANDIDATE_K ?? 12),
  ragHighConfidenceThreshold: Number(process.env.RAG_HIGH_CONFIDENCE_THRESHOLD ?? 0.75),
  ragLowConfidenceThreshold: Number(process.env.RAG_LOW_CONFIDENCE_THRESHOLD ?? 0.35),
  maxChatMessageCharacters: Number(process.env.MAX_CHAT_MESSAGE_CHARACTERS ?? 2000),
  maxReportCharacters: Number(process.env.MAX_REPORT_CHARACTERS ?? 60000),
};

export const openWeightModelPlan = {
  recommendedBaseModel: "google/medgemma-4b-it",
  highAccuracyTextModel: "google/medgemma-27b-text-it",
  multilingualGeneralistFallback: "Qwen/Qwen3-8B",
  adaptationMethod: "QLoRA supervised fine-tuning with retrieval-augmented generation and clinical safety evaluation",
};
