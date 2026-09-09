// Compartido entre src/app/api/postular/route.ts (servidor) y
// src/components/empleos/application-form.tsx (cliente) — un solo lugar
// para el techo que ambos deben respetar, en vez de dos literales con
// comentarios de "mantener sincronizado" que pueden desalinearse.
//
// Vercel corta cualquier request de función en 4.5 MB a nivel de
// plataforma, fijo, no configurable — estos números se quedan cómodamente
// por debajo, dejando margen para el resto del multipart (campos de texto,
// boundaries) incluso cuando el candidato adjunta CV + archivos
// adicionales en el mismo envío.
export const MAX_CV_BYTES = 4 * 1024 * 1024;
export const MAX_ADDITIONAL_FILE_BYTES = 1 * 1024 * 1024;
export const MAX_TOTAL_UPLOAD_BYTES = 4.3 * 1024 * 1024;
