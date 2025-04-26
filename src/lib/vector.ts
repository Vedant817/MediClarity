import { Pinecone } from "@pinecone-database/pinecone";

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
});

export const getPineconeIndex = async () => {
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    return index;
};
