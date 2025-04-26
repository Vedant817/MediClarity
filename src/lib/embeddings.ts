import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex } from "./vector";

const embeddingModel = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY!,
});

export async function embedDocuments(chunks: { text: string; metadata: any }[], namespace: string) {
    const docs = chunks.map(c => new Document({ pageContent: c.text, metadata: c.metadata }));
    const index = await getPineconeIndex();
    await PineconeStore.fromDocuments(docs, embeddingModel, {
        pineconeIndex: index,
        namespace,
    });
}

export async function similaritySearch(input: string, namespace: string, k: number = 5) {
    const index = await getPineconeIndex();
    const store = await PineconeStore.fromExistingIndex(embeddingModel, {
        pineconeIndex: index,
        namespace,
    });
    const results = await store.similaritySearch(input, k);
    return results.map(r => r.pageContent);
}

export async function deleteNamespace(namespace: string) {
    const index = await getPineconeIndex();
    await index.namespace(namespace).deleteAll();
}