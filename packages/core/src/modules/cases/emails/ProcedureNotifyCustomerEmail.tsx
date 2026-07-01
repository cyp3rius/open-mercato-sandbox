import React from 'react'
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Text,
  Section,
  Hr,
} from '@react-email/components'

export type ProcedureNotifyCustomerEmailCopy = {
  preview: string
  heading: string
  footer: string
}

export type ProcedureNotifyCustomerEmailProps = {
  subject: string
  bodyHtml: string
  copy: ProcedureNotifyCustomerEmailCopy
}

export function ProcedureNotifyCustomerEmail({
  subject,
  bodyHtml,
  copy,
}: ProcedureNotifyCustomerEmailProps) {
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
          <Text style={{ margin: '0 0 16px', fontSize: '14px', color: '#202124' }}>{copy.heading}</Text>
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

          <Hr style={{ borderColor: '#dadce0', margin: '24px 0 12px' }} />
          <Text style={{ margin: 0, fontSize: '12px', color: '#5f6368' }}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ProcedureNotifyCustomerEmail
