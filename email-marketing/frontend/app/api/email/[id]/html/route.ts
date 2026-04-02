import {NextResponse} from 'next/server'
import mjml2html from 'mjml'

import {client} from '@/sanity/client'
import {emailByIdQuery} from '@/sanity/queries'
import {assembleEmailMjml} from '@/lib/email/mjml'

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params

  const email = await client.fetch(emailByIdQuery, {id})

  if (!email) {
    return NextResponse.json({error: 'Email not found'}, {status: 404})
  }

  try {
    const mjmlString = assembleEmailMjml(email)
    const {html, errors} = mjml2html(mjmlString)

    if (errors.length > 0) {
      console.error('MJML compilation errors:', errors)
    }

    return NextResponse.json({
      html,
      subject: email.subject ?? '',
      preheader: email.preheader ?? '',
    })
  } catch (error) {
    console.error('MJML compilation failed:', error)
    return NextResponse.json({error: 'Failed to compile email'}, {status: 500})
  }
}
