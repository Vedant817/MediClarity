/**
 * Pure helpers for the printable doctor packet (jsPDF).
 * Kept UI-free so the parsing/normalization rules are unit-testable:
 * summaries are LLM markdown and routinely contain pipe tables,
 * unicode dashes/quotes, and emphasis markers that WinAnsi PDF
 * fonts cannot render.
 */

export type PacketBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string; depth: number }
  | { kind: "table"; header: string[]; rows: string[][] };

const SEPARATOR_CELL = /^:?-{2,}:?$/;

function stripEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__([^_]+?)__/g, "$1")
    .replace(/[*_`]/g, "");
}

/**
 * Normalize a string to what jsPDF's built-in WinAnsi fonts can render.
 * Maps curly quotes/dashes/bullets to ASCII, converts non-breaking
 * spaces, and drops control characters that otherwise print as
 * missing glyphs or blow out line widths.
 */
export function cleanPacketText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .split("\n")
    .map((line) => stripEmphasis(line).replace(/ {2,}/g, " ").trimEnd())
    .join("\n")
    .trim();
}

function splitPipeRow(line: string): string[] {
  const cells = line.trim().split("|").map((cell) => cell.trim());
  if (cells.length > 0 && cells[0] === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell));
}

function parseTableBlock(lines: string[]): { header: string[]; rows: string[][] } {
  const rows = lines.map(splitPipeRow).filter((cells) => cells.length > 0 && !isSeparatorRow(cells));
  const [header = [], ...body] = rows;
  return { header, rows: body };
}

/**
 * Split an LLM markdown summary into renderable blocks. Pipe-table
 * blocks are returned as structured tables (callers may skip them
 * when structured lab rows already cover the same data); everything
 * else becomes headings, paragraphs, or bullets with no markdown
 * syntax left behind.
 */
export function splitSummaryBlocks(markdown: unknown): PacketBlock[] {
  if (typeof markdown !== "string" || !markdown.trim()) return [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: PacketBlock[] = [];
  let paragraph: string[] = [];
  let table: string[] = [];

  const flushParagraph = () => {
    const text = cleanPacketText(paragraph.join(" "));
    if (text) blocks.push({ kind: "paragraph", text });
    paragraph = [];
  };
  const flushTable = () => {
    if (table.length === 0) return;
    const { header, rows } = parseTableBlock(table);
    if (header.length > 0 || rows.length > 0) {
      blocks.push({
        kind: "table",
        header: header.map(cleanPacketText),
        rows: rows.map((row) => row.map(cleanPacketText)),
      });
    }
    table = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("|")) {
      flushParagraph();
      table.push(line);
      continue;
    }
    flushTable();
    if (!line) {
      flushParagraph();
      continue;
    }
    const hashHeading = line.match(/^#{1,4}\s+(.+)$/);
    if (hashHeading) {
      flushParagraph();
      blocks.push({ kind: "heading", text: cleanPacketText(hashHeading[1]) });
      continue;
    }
    // Numbered sections ("1. What this report was for") are headings.
    // Longer numbered sentences stay body text.
    const numberedHeading = line.match(/^\d+\.\s+(\S.*)$/);
    if (numberedHeading && line.length <= 120) {
      flushParagraph();
      blocks.push({ kind: "heading", text: cleanPacketText(line) });
      continue;
    }
    const bullet = rawLine.match(/^(\s*)[-*•]\s+(.+)$/) ?? rawLine.match(/^(\s*)\d+\)\s+(.+)$/);
    if (bullet && bullet[2].trim()) {
      flushParagraph();
      blocks.push({
        kind: "bullet",
        text: cleanPacketText(bullet[2]),
        depth: bullet[1].replace(/\t/g, "  ").length >= 2 ? 1 : 0,
      });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushTable();
  return blocks;
}

export type PacketLab = {
  test: string;
  value: string;
  unit?: string | null;
  refMin?: number | null;
  refMax?: number | null;
  flag: string;
};

/** "13.2 g/dL" — never "13.2 /g/dL", never double spaces. */
export function formatPacketValue(lab: PacketLab): string {
  return cleanPacketText(`${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`);
}

/** "13-17" with ASCII dash; unknown bounds become an em-space-free "?". */
export function formatPacketRange(lab: PacketLab): string {
  const min = lab.refMin ?? null;
  const max = lab.refMax ?? null;
  if (min === null && max === null) return "-";
  return `${min === null ? "?" : min}-${max === null ? "?" : max}`;
}

export type PacketLabRow = {
  canonicalName?: string | null;
  test: string;
  value: number | string;
  unit?: string | null;
  refMin?: number | null;
  refMax?: number | null;
  flag: string;
};

export type PacketReport = {
  createdAt: string | number | Date;
  summary: string;
  labs?: PacketLabRow[] | null;
};

type RGB = [number, number, number];

export type PacketDoc = {
  setFont: (name: string, style?: string) => unknown;
  setFontSize: (size: number) => unknown;
  setTextColor: (r: number, g: number, b: number) => unknown;
  setDrawColor: (r: number, g: number, b: number) => unknown;
  setFillColor: (r: number, g: number, b: number) => unknown;
  setLineWidth: (w: number) => unknown;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  text: (text: string, x: number, y: number) => unknown;
  line: (x1: number, y1: number, x2: number, y2: number) => unknown;
  rect: (x: number, y: number, w: number, h: number, style?: string) => unknown;
  addPage: () => unknown;
};

const PINE: RGB = [16, 44, 42];
const TEAL: RGB = [11, 118, 110];
const ROSE: RGB = [185, 28, 28];
const AMBER: RGB = [180, 83, 9];
const GRAY: RGB = [110, 110, 110];
const BLACK: RGB = [0, 0, 0];
const PAGE_BOTTOM = 770;

function drawTable(
  pdf: PacketDoc,
  y0: number,
  header: string[],
  rows: string[][],
  widths: number[],
  margin: number,
  flagColumn: number | null,
): number {
  let y = y0;
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      pdf.addPage();
      y = 48;
    }
  };
  const drawRow = (cells: string[], opts: { header?: boolean; shade?: boolean; stripe?: boolean } = {}) => {
    pdf.setFont("helvetica", opts.header ? "bold" : "normal");
    pdf.setFontSize(9);
    const wrapped = cells.map((cell, i) => pdf.splitTextToSize(cell, widths[i] - 10));
    const rowH = Math.max(...wrapped.map((w) => w.length), 1) * 12 + 8;
    ensureSpace(rowH);
    if (!opts.header && (opts.shade || opts.stripe)) {
      pdf.setFillColor(...(opts.shade ? ([220, 236, 231] as RGB) : ([247, 249, 248] as RGB)));
      pdf.rect(margin, y, widths.reduce((a, b) => a + b, 0), rowH, "F");
    }
    let x = margin;
    cells.forEach((_, i) => {
      if (opts.header && opts.shade) {
        pdf.setFillColor(220, 236, 231);
        pdf.rect(x, y, widths[i], rowH, "F");
      }
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.6);
      pdf.rect(x, y, widths[i], rowH);
      const isFlag = flagColumn === i && !opts.header;
      const flag = isFlag ? cells[i].toLowerCase() : "";
      const color: RGB = opts.header
        ? PINE
        : flag === "high"
          ? ROSE
          : flag === "low"
            ? AMBER
            : flag === "unknown"
              ? GRAY
              : BLACK;
      pdf.setTextColor(...color);
      wrapped[i].forEach((line, li) => pdf.text(line, x + 5, y + 12 + li * 12));
      x += widths[i];
    });
    y += rowH;
  };
  drawRow(header, { header: true, shade: true });
  let stripe = false;
  for (const row of rows) {
    const padded = [...row];
    while (padded.length < header.length) padded.push("");
    drawRow(padded.slice(0, header.length), { stripe });
    stripe = !stripe;
  }
  return y;
}

/**
 * Render the full doctor packet onto a jsPDF-compatible document.
 * Tables are drawn as real grids (never raw markdown), every string
 * passes through cleanPacketText, and every element reserves space
 * before drawing so nothing runs off the page.
 */
export function buildDoctorPacket(pdf: PacketDoc, report: PacketReport): void {
  const MARGIN = 46;
  const WIDTH = 595.28 - MARGIN * 2;
  let y = 54;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      pdf.addPage();
      y = 48;
    }
  };
  const paragraph = (
    text: string,
    x = MARGIN,
    size = 9.5,
    leading = 13.5,
    bold = false,
    color: RGB = BLACK,
  ) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    for (const line of pdf.splitTextToSize(text, WIDTH - (x - MARGIN))) {
      ensureSpace(leading);
      pdf.text(line, x, y);
      y += leading;
    }
  };
  const sectionHeading = (text: string) => {
    y += 8;
    ensureSpace(34);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...PINE);
    pdf.text(text, MARGIN, y);
    y += 8;
    pdf.setDrawColor(...TEAL);
    pdf.setLineWidth(1.2);
    pdf.line(MARGIN, y, MARGIN + 44, y);
    y += 12;
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(...PINE);
  pdf.text("MediClarity doctor packet", MARGIN, y);
  y += 8;
  pdf.setDrawColor(...TEAL);
  pdf.setLineWidth(2);
  pdf.line(MARGIN, y, MARGIN + WIDTH, y);
  y += 18;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...GRAY);
  pdf.text(`Report date: ${new Date(report.createdAt).toLocaleDateString()}`, MARGIN, y);
  y += 10;

  sectionHeading("Abnormal structured results");
  const labs = report.labs ?? [];
  const abnormal = labs.filter((lab) => lab.flag === "high" || lab.flag === "low");
  if (abnormal.length === 0) {
    paragraph("No abnormal structured rows available.");
  } else {
    for (const lab of abnormal) {
      paragraph(
        `-  ${cleanPacketText(lab.canonicalName || lab.test)}: ${formatPacketValue({ test: "", value: String(lab.value), unit: lab.unit ?? null, flag: lab.flag })} (${lab.flag})`,
        MARGIN + 6,
      );
    }
  }

  sectionHeading("Findings table");
  if (labs.length === 0) {
    paragraph("No structured lab rows were extracted from this report.");
  } else {
    const widths = [196, 96, 112, WIDTH - 196 - 96 - 112];
    y = drawTable(
      pdf,
      y,
      ["Test", "Result", "Reference", "Status"],
      labs.map((lab) => [
        cleanPacketText(lab.canonicalName || lab.test),
        formatPacketValue({ test: "", value: String(lab.value), unit: lab.unit ?? null, flag: lab.flag }),
        formatPacketRange({ test: "", value: "", refMin: lab.refMin ?? null, refMax: lab.refMax ?? null, flag: lab.flag }),
        lab.flag,
      ]),
      widths,
      MARGIN,
      3,
    );
  }

  sectionHeading("Plain-language summary");
  const hasStructuredLabs = labs.length > 0;
  for (const block of splitSummaryBlocks(report.summary)) {
    if (block.kind === "heading") {
      y += 4;
      ensureSpace(28);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(...PINE);
      for (const line of pdf.splitTextToSize(block.text, WIDTH)) {
        ensureSpace(15);
        pdf.text(line, MARGIN, y);
        y += 15;
      }
    } else if (block.kind === "bullet") {
      paragraph(`-  ${block.text}`, MARGIN + block.depth * 14);
    } else if (block.kind === "paragraph") {
      paragraph(block.text);
      y += 3;
    } else if (!hasStructuredLabs && (block.header.length > 0 || block.rows.length > 0)) {
      // Summary-embedded table, only when no structured rows exist (avoids duplication).
      const count = Math.max(block.header.length, 1);
      const widths = block.header.map(() => WIDTH / count);
      const paddedRows = block.rows.map((row) => {
        const padded = [...row];
        while (padded.length < block.header.length) padded.push("");
        return padded.slice(0, block.header.length);
      });
      y = drawTable(pdf, y, block.header, paddedRows, widths, MARGIN, null);
    }
  }

  y += 10;
  ensureSpace(60);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...PINE);
  pdf.text("Questions to ask", MARGIN, y);
  y += 18;
  for (const question of [
    "Which results need follow-up?",
    "Should any test be repeated, and when?",
    "Do medicines or recent illness affect these results?",
  ]) {
    paragraph(`-  ${question}`, MARGIN + 6);
  }
  y += 12;
  ensureSpace(24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  for (const line of pdf.splitTextToSize(
    "For information only, not medical advice or diagnosis. Verify all rows against the source report.",
    WIDTH,
  )) {
    ensureSpace(13);
    pdf.text(line, MARGIN, y);
    y += 13;
  }
}
