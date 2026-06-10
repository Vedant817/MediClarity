interface ChunkTextOptions {
    chunkSize?: number;
    overlap?: number;
}

export function chunkText(text: string, options: ChunkTextOptions = {}) {
    const chunkSize = options.chunkSize ?? 1800;
    const overlap = options.overlap ?? 200;
    const normalized = text.replace(/\s+/g, " ").trim();

    if (!normalized) {
        return [];
    }

    if (normalized.length <= chunkSize) {
        return [normalized];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
        const hardEnd = Math.min(start + chunkSize, normalized.length);
        const softEnd = normalized.lastIndexOf(". ", hardEnd);
        const end = softEnd > start + chunkSize * 0.6 ? softEnd + 1 : hardEnd;
        chunks.push(normalized.slice(start, end).trim());

        if (end >= normalized.length) {
            break;
        }

        start = Math.max(0, end - overlap);
    }

    return chunks.filter(Boolean);
}
