import "server-only";

const EXACT_SIGNATURES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

// El PDF permite bytes arbitrarios ANTES de "%PDF-" (algunos generadores
// anteponen un comentario o BOM) — el spec (ISO 32000) exige que el header
// aparezca dentro de los primeros 1024 bytes, no necesariamente en el byte
// 0. JPEG/PNG sí exigen su firma exacta desde el primer byte.
const PDF_HEADER = [0x25, 0x50, 0x44, 0x46]; // %PDF
const PDF_SCAN_WINDOW = 1024;

/**
 * Confirma que el archivo empieza con los bytes reales del formato que dice
 * ser. `file.type` es una etiqueta que manda el navegador — el endpoint es
 * público y nada obliga a pasar por el <input type="file"> real, así que un
 * POST directo puede declarar "application/pdf" sobre cualquier contenido.
 */
export async function matchesDeclaredType(file: File): Promise<boolean> {
  if (file.type === "application/pdf") {
    const head = new Uint8Array(await file.slice(0, PDF_SCAN_WINDOW).arrayBuffer());
    for (let offset = 0; offset <= head.length - PDF_HEADER.length; offset++) {
      if (PDF_HEADER.every((byte, i) => head[offset + i] === byte)) return true;
    }
    return false;
  }

  const signature = EXACT_SIGNATURES[file.type];
  if (!signature) return false;
  const head = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
  return signature.every((byte, i) => head[i] === byte);
}
