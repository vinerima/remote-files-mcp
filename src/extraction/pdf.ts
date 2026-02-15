import { readFile } from "node:fs/promises";
import pdfParse from "pdf-parse";

export async function extractPdf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}
