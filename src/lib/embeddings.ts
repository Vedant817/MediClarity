import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex } from "./vector";
import { aiModelConfig } from "./ai/model-config";

const embeddingModel = new GoogleGenerativeAIEmbeddings({
    model: aiModelConfig.embeddingModel,
    apiKey: process.env.GEMINI_API_KEY!,
});

interface ChunkMetaData {
    userId: string;
    [key: string]: unknown;
}

export interface RetrievedDocument {
    pageContent: string;
    metadata: Record<string, unknown>;
    score: number;
}

export async function embedDocuments(chunks: { text: string; metadata: ChunkMetaData }[], namespace: string) {
    if (chunks.length === 0) {
        console.log("No chunks to embed");
        return;
    }

    const docs = chunks.map(c => new Document({ pageContent: c.text, metadata: c.metadata }));
    const index = await getPineconeIndex();
    await PineconeStore.fromDocuments(docs, embeddingModel, {
        pineconeIndex: index,
        namespace,
    });
}

export async function similaritySearch(input: string, namespace: string, k: number = 5) {
    const results = await similaritySearchWithScore(input, namespace, k);
    return results.map(r => r.pageContent);
}

export async function similaritySearchWithScore(input: string, namespace: string, k: number = 5): Promise<RetrievedDocument[]> {
    try {
        const index = await getPineconeIndex();
        const store = await PineconeStore.fromExistingIndex(embeddingModel, {
            pineconeIndex: index,
            namespace,
        });
        const results = await store.similaritySearchWithScore(input, k);
        return results.map((result: unknown) => {
            const [document, score] = result as [{ pageContent: string; metadata?: Record<string, unknown> }, number];
            return {
                pageContent: document.pageContent,
                metadata: document.metadata ?? {},
                score: typeof score === "number" ? score : 0,
            };
        });
    } catch (error) {
        console.error("Error in similarity search:", error);
        return [];
    }
}

export async function deleteNamespace(namespace: string) {
    try {
        const index = await getPineconeIndex();

        const stats = await index.describeIndexStats();
        const namespaces = stats.namespaces || {};

        if (namespaces[namespace]) {
            await index.namespace(namespace).deleteAll();
            console.log(`Namespace ${namespace} deleted successfully`);
        } else {
            console.log(`Namespace ${namespace} does not exist, skipping deletion`);
        }
    } catch (error) {
        console.error(`Error deleting namespace ${namespace}:`, error);
    }
}
