import { NextRequest } from 'next/server'
import { auth } from '@/server/lib/auth'
import { receiptService } from '@/server/services/receipt.service'
import { successResponse, unauthorizedResponse, validationErrorResponse, handleApiError } from '@/server/lib/api-response'
import { UploadReceiptMetadataSchema } from '@/server/validators/receipt.validator'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const body = await req.json()
    const parsed = UploadReceiptMetadataSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error.format())

    // Mock fileUrl and storagePublicId if not provided (for tests / decoupled storage)
    const data = {
      ...parsed.data,
      fileUrl: body.fileUrl || 'mock_url',
      storagePublicId: body.storagePublicId || 'mock_public_id',
    }

    const receipt = await receiptService.addReceipt(session.user, id, data)
    return successResponse(receipt, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const receipts = await receiptService.getReceipts(session.user, id)
    return successResponse(receipts)
  } catch (error) {
    return handleApiError(error)
  }
}
