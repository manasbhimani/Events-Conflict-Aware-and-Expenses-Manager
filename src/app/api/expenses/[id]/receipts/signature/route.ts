import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { receiptService } from '@/server/services/receipt.service'
import { successResponse, unauthorizedResponse, handleApiError } from '@/server/lib/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    

    const { id } = await params
    const signatureData = receiptService.generateSignature(user, id)
    return successResponse(signatureData)
  } catch (error) {
    return handleApiError(error)
  }
}
