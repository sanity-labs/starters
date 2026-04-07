import {documentEventHandler} from '@sanity/functions'
import {createClient} from '@sanity/client'
import groq from 'groq'
import {klaviyoFetch} from '../lib/klaviyo'
import {renderEmailHtml} from '../lib/mjml'
import type {EmailDocument} from '../lib/mjml'

const EMAIL_QUERY = groq`
  *[_id == $id][0]{
    _id,
    title,
    subject,
    preheader,
    status,
    sendState,
    externalTemplateId,
    externalCampaignId,
    "campaigns": *[_type == "campaign" && email._ref == ^._id]{
      _id, title,
      "lists": lists[]->{_id, name, externalId},
      "includedSegments": includedSegments[]->{_id, name, externalId},
      "excludedSegments": excludedSegments[]->{_id, name, externalId}
    },
    body[]{
      ...,
      _type == "emailSection" => {
        ...,
        "imageUrl": image.asset->url,
        products[]->{_id, title, price, description, url, "imageUrl": image.asset->url}
      },
      _type == "emailHeader" => {
        ...,
        "logoImageUrl": logoUrl.asset->url
      }
    }
  }
`

const SETTINGS_QUERY = groq`*[_type == "emailSettings"][0]{fromEmail, replyToEmail, fromLabel}`

export const handler = documentEventHandler(async ({context, event}) => {
  const client = createClient({...context.clientOptions, apiVersion: '2025-05-08', useCdn: false})
  const docId = event.data._id

  const email = await client.fetch(EMAIL_QUERY, {id: docId})
  if (!email) {
    console.error(`[send-email] Email ${docId} not found`)
    return
  }

  console.log(`[send-email] Starting send for "${email.title}" (${docId})`)
  console.log(`[send-email] Subject: "${email.subject}"`)
  console.log(`[send-email] Campaigns: ${(email.campaigns ?? []).length}`)

  await client.patch(docId).set({sendState: 'sending'}).commit()

  try {
    // Validate prerequisites
    const settings = await client.fetch(SETTINGS_QUERY)
    if (!settings?.fromEmail || !settings?.fromLabel) {
      throw new Error(
        'Email Settings not configured. Set From Email and From Name in Email Settings.',
      )
    }

    const campaigns = email.campaigns ?? []
    if (campaigns.length === 0) {
      throw new Error(
        'No campaigns reference this email. Create a campaign and assign this email first.',
      )
    }

    if (!email.subject) {
      throw new Error('Email must have a subject line')
    }

    if (!email.body || email.body.length === 0) {
      throw new Error('Email must have body content')
    }

    console.log(
      `[send-email] Settings: from="${settings.fromLabel}" <${settings.fromEmail}>, reply-to=${settings.replyToEmail ?? settings.fromEmail}`,
    )

    // Render email HTML
    const html = renderEmailHtml(email as EmailDocument)
    console.log(`[send-email] Rendered HTML (${html.length} chars)`)

    // Create Klaviyo template
    const templateResult = await klaviyoFetch('/templates/', {
      method: 'POST',
      body: {
        data: {
          type: 'template',
          attributes: {
            name: `${email.title ?? 'Email'} - ${new Date().toISOString().split('T')[0]}`,
            editor_type: 'CODE',
            html,
          },
        },
      },
    })
    const templateId = templateResult.data.id
    console.log(`[send-email] Created Klaviyo template: ${templateId}`)
    await client.patch(docId).set({externalTemplateId: templateId}).commit()

    // Send to each campaign's audience
    for (const campaign of campaigns) {
      const lists = campaign.lists ?? []
      if (lists.length === 0) {
        throw new Error(`Campaign "${campaign.title}" must have at least one subscriber list`)
      }
      const unsyncedLists = lists.filter((l: any) => !l.externalId)
      if (unsyncedLists.length > 0) {
        throw new Error(
          `Campaign "${campaign.title}": all lists must be imported from Klaviyo first`,
        )
      }

      const includedSegments = campaign.includedSegments ?? []
      const excludedSegments = campaign.excludedSegments ?? []

      const allSegments = [...includedSegments, ...excludedSegments]
      const unsyncedSegments = allSegments.filter((s: any) => !s.externalId)
      if (unsyncedSegments.length > 0) {
        const names = unsyncedSegments.map((s: any) => s.name).join(', ')
        throw new Error(
          `Campaign "${campaign.title}": these segments must be imported from Klaviyo first: ${names}`,
        )
      }

      // Build Klaviyo audience payload
      const listIds = lists.map((l: any) => l.externalId)
      const includedSegmentIds = includedSegments.map((s: any) => s.externalId)
      const includedIds = [...listIds, ...includedSegmentIds]
      const excludedIds = excludedSegments.map((s: any) => s.externalId).filter(Boolean)

      const listNames = lists.map((l: any) => `${l.name} (${l.externalId})`).join(', ')
      console.log(`[send-email] Campaign "${campaign.title}" — Lists: ${listNames}`)
      if (includedSegments.length > 0) {
        const segNames = includedSegments.map((s: any) => `${s.name} (${s.externalId})`).join(', ')
        console.log(`[send-email] Campaign "${campaign.title}" — Included segments: ${segNames}`)
      }
      if (excludedSegments.length > 0) {
        const segNames = excludedSegments.map((s: any) => `${s.name} (${s.externalId})`).join(', ')
        console.log(`[send-email] Campaign "${campaign.title}" — Excluded segments: ${segNames}`)
      }
      console.log(
        `[send-email] Campaign "${campaign.title}" — Audience IDs: included=[${includedIds.join(', ')}]${excludedIds.length > 0 ? `, excluded=[${excludedIds.join(', ')}]` : ''}`,
      )

      // Create Klaviyo campaign with inline message definition
      const campaignResult = await klaviyoFetch('/campaigns/', {
        method: 'POST',
        body: {
          data: {
            type: 'campaign',
            attributes: {
              name: `${campaign.title} — ${email.title ?? 'Email'}`,
              audiences: {
                included: includedIds,
                ...(excludedIds.length > 0 ? {excluded: excludedIds} : {}),
              },
              'campaign-messages': {
                data: [
                  {
                    type: 'campaign-message',
                    attributes: {
                      definition: {
                        channel: 'email',
                        content: {
                          subject: email.subject,
                          preview_text: email.preheader ?? '',
                          from_email: settings.fromEmail,
                          from_label: settings.fromLabel,
                          reply_to_email: settings.replyToEmail ?? settings.fromEmail,
                        },
                        label: email.title ?? 'Email',
                      },
                    },
                  },
                ],
              },
              send_strategy: {method: 'immediate'},
            },
          },
        },
      })
      const klaviyoCampaignId = campaignResult.data.id
      console.log(
        `[send-email] Campaign "${campaign.title}" — Created Klaviyo campaign: ${klaviyoCampaignId}`,
      )

      // Get the message ID from the campaign response and assign the template
      const messageId = campaignResult.data.relationships?.['campaign-messages']?.data?.[0]?.id
      if (!messageId) {
        throw new Error(
          `Campaign "${campaign.title}": no campaign message ID returned from Klaviyo`,
        )
      }

      console.log(
        `[send-email] Campaign "${campaign.title}" — Assigning template ${templateId} to message ${messageId}`,
      )
      // Assign template to campaign message
      await klaviyoFetch('/campaign-message-assign-template', {
        method: 'POST',
        body: {
          data: {
            type: 'campaign-message',
            id: messageId,
            relationships: {
              template: {data: {type: 'template', id: templateId}},
            },
          },
        },
      })

      // Trigger the send
      console.log(`[send-email] Campaign "${campaign.title}" — Triggering send job...`)
      await klaviyoFetch('/campaign-send-jobs/', {
        method: 'POST',
        body: {
          data: {
            type: 'campaign-send-job',
            id: klaviyoCampaignId,
          },
        },
      })

      console.log(`[send-email] Campaign "${campaign.title}" — Send job triggered successfully`)
    }

    // Store the last campaign ID (for reference)
    await client
      .patch(docId)
      .set({externalCampaignId: campaigns[campaigns.length - 1]?._id})
      .commit()

    // Success
    const now = new Date().toISOString()
    const campaignTitles = campaigns.map((c: any) => c.title).join(', ')
    await client
      .patch(docId)
      .set({
        sendState: 'sent',
        sendErrorMessage: '',
        lastSentAt: now,
        status: 'sent',
      })
      .append('sendLog', [
        {
          _type: 'sendLogEntry',
          _key: `send-${Date.now()}`,
          timestamp: now,
          status: 'sent',
          campaignTitles,
        },
      ])
      .commit()

    console.log(
      `[send-email] Successfully sent "${email.title}" via ${campaigns.length} campaign(s)`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const campaignTitles = (email.campaigns ?? []).map((c: any) => c.title).join(', ')
    await client
      .patch(docId)
      .set({sendState: 'error', sendErrorMessage: message.slice(0, 500)})
      .append('sendLog', [
        {
          _type: 'sendLogEntry',
          _key: `send-${Date.now()}`,
          timestamp: new Date().toISOString(),
          status: 'error',
          campaignTitles,
          errorMessage: message.slice(0, 500),
        },
      ])
      .commit()
    console.error(`[send-email] Failed to send "${email.title}": ${message}`)
  }
})
