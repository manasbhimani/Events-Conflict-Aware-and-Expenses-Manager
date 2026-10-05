import { NextRequest } from 'next/server'
import { auth } from '@/server/lib/auth'
import { receiptService } from '@/server/services/receipt.service'
import { successResponse, unauthorizedResponse, handleApiError } from '@/server/lib/api-response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const signatureData = receiptService.generateSignature(session.user, id)
    return successResponse(signatureData)
  } catch (error) {
    return handleApiError(error)
  }
}
