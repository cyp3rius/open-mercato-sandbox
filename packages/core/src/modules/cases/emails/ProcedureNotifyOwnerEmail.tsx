import React from 'react'
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Text,
  Section,
  Link,
  Hr,
} from '@react-email/components'

export type ProcedureNotifyOwnerEmailCopy = {
  preview: string
  heading: string
  caseLabel: string
  stepLabel: string
  viewCta: string
  footer: string
}

export type ProcedureNotifyOwnerEmailProps = {
  subject: string
  caseTitle: string
  stepLabel?: string | null
  bodyHtml: string
  viewUrl?: string | null
  copy: ProcedureNotifyOwnerEmailCopy
}

export function ProcedureNotifyOwnerEmail({
  subject,
  caseTitle,
  stepLabel,
  bodyHtml,
  viewUrl,
  copy,
}: ProcedureNotifyOwnerEmailProps) {
  return (
    <Html>
      <Head>
        <title>{subject}</title>
      </Head>
      <Preview>{copy.preview}</Preview>
      <Body
        style={{
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          padding: '12px 0',
          margin: 0,
        }}
      >
        <Container style={{ padding: '0 16px', margin: 0, maxWidth: '640px' }}>
          <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#202124' }}>{copy.heading}</Text>
          <Text style={{ margin: '0 0 4px', color: '#5f6368', fontSize: '14px' }}>
            {copy.caseLabel}: {caseTitle}
          </Text>
          {stepLabel ? (
            <Text style={{ margin: '0 0 16px', color: '#5f6368', fontSize: '14px' }}>
              {copy.stepLabel}: {stepLabel}
            </Text>
          ) : (
            <Text style={{ margin: '0 0 16px' }}>&nbsp;</Text>
          )}
          <Text style={{ margin: '0 0 12px', fontSize: '20px', lineHeight: 1.3, color: '#202124' }}>
            {subject}
          </Text>
          <Section
            style={{
              color: '#202124',
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            <div style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {viewUrl ? (
            <Section style={{ marginTop: '16px' }}>
              <Text style={{ margin: 0, fontSize: '14px', color: '#202124' }}>
                <Link href={viewUrl} style={{ color: '#1a73e8', textDecoration: 'none' }}>
                  {copy.viewCta}
                </Link>
              </Text>
            </Section>
          ) : null}

          <Hr style={{ borderColor: '#dadce0', margin: '24px 0 12px' }} />
          <Text style={{ margin: 0, fontSize: '12px', color: '#5f6368' }}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ProcedureNotifyOwnerEmail
