const NOISE_ONLY = /^(?:\[?(?:noise|background noise|music|silence|inaudible)\]?|(?:uh+|um+|hmm+|mm+|ah+)[.!?\s]*)$/iu;

export function cleanVoiceTranscript(value: string): string | null {
  const cleaned = value
    .replace(/\[(?:noise|background noise|music|silence|inaudible)\]/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2_000);
  if (!cleaned || NOISE_ONLY.test(cleaned)) return null;
  return cleaned;
}

export function pcm16Rms(chunk: ArrayBuffer): number {
  const samples = new Int16Array(chunk, 0, Math.floor(chunk.byteLength / 2));
  if (!samples.length) return 0;
  let energy = 0;
  for (const sample of samples) {
    const normalized = sample / 32768;
    energy += normalized * normalized;
  }
  return Math.sqrt(energy / samples.length);
}
