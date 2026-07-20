"use client"

import SimpleDocumentEditor from '../../../../components/simple/SimpleDocumentEditor'

export default function SimpleQuoteDetailPage({ params }: { params?: { id?: string } }) {
  const id = typeof params?.id === 'string' ? params.id : ''
  return <SimpleDocumentEditor kind="quote" mode="edit" documentId={id} />
}
