import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { PineconeStore } from "@langchain/pinecone";
import { getPineconeIndex } from "./vector";

const embeddingModel = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-exp-03-07",
    apiKey: process.env.GEMINI_API_KEY!,
});

interface ChunkMetaData {
    userId: string;
    [key: string]: unknown;
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
    try {
        const index = await getPineconeIndex();
        const store = await PineconeStore.fromExistingIndex(embeddingModel, {
            pineconeIndex: index,
            namespace,
        });
        const results = await store.similaritySearch(input, k);
        return results.map(r => r.pageContent);
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