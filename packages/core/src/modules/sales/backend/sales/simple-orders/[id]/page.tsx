"use client"

import SimpleDocumentEditor from '../../../../components/simple/SimpleDocumentEditor'

export default function SimpleOrderDetailPage({ params }: { params?: { id?: string } }) {
  const id = typeof params?.id === 'string' ? params.id : ''
  return <SimpleDocumentEditor kind="order" mode="edit" documentId={id} />
}
