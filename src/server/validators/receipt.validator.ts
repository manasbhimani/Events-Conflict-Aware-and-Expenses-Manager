import { z } from 'zod'

export const UploadReceiptMetadataSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']),
  fileSizeBytes: z.number().int().min(1).max(5 * 1024 * 1024), // 5MB
  sha256: z.string().length(64), // Hex SHA256
})

// Used by the client to get an upload signature
export const ReceiptSignatureRequestSchema = z.object({
  expenseId: z.string().min(1),
})
