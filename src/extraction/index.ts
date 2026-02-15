import { extname } from "node:path";
import { extractDocx } from "./docx.js";
import { extractPdf } from "./pdf.js";
import { extractText, isTextFile } from "./text.js";

export interface ExtractionResult {
  extracted: boolean;
  contentType: string;
  text: string | null;
}

export async function extractContent(
  filePath: string,
  maxLength: number
): Promise<ExtractionResult> {
  const ext = extname(filePath).toLowerCase();
  let text: string | null = null;
  let contentType = ext.replace(".", "") || "unknown";

  try {
    if (ext === ".docx") {
      text = await extractDocx(filePath);
      contentType = "docx";
    } else if (ext === ".pdf") {
      text = await extractPdf(filePath);
      contentType = "pdf";
    } else if (isTextFile(ext)) {
      text = await extractText(filePath);
      contentType = ext.replace(".", "");
    } else {
      return { extracted: false, contentType, text: null };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      extracted: false,
      contentType,
      text: `Extraction failed: ${msg}`,
    };
  }

  if (text && text.length > maxLength) {
    text =
      text.slice(0, maxLength) +
      `\n\n[Content truncated at ${Math.round(maxLength / 1024)}KB]`;
  }

  return { extracted: true, contentType, text };
}
