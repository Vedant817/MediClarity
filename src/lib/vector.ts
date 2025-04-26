import { Pinecone } from "@pinecone-database/pinecone";

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

export const getPineconeIndex = async () => {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    try {
        return index;
    } catch (error) {
        console.error("Error retrieving Pinecone index:", error);
        throw error;
    }
};