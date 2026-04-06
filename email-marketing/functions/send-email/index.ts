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

    // Render email HTML
    const html = renderEmailHtml(email as EmailDocument)

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

      // Get the message ID from the campaign response and assign the template
      const messageId = campaignResult.data.relationships?.['campaign-messages']?.data?.[0]?.id
      if (!messageId) {
        throw new Error(
          `Campaign "${campaign.title}": no campaign message ID returned from Klaviyo`,
        )
      }

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
      await klaviyoFetch('/campaign-send-jobs/', {
        method: 'POST',
        body: {
          data: {
            type: 'campaign-send-job',
            id: klaviyoCampaignId,
          },
        },
      })

      console.log(`[send-email] Sent "${email.title}" via campaign "${campaign.title}"`)
    }

    // Store the last campaign ID (for reference)
    await client
      .patch(docId)
      .set({externalCampaignId: campaigns[campaigns.length - 1]?._id})
      .commit()

    // Success
    await client
      .patch(docId)
      .set({
        sendState: 'sent',
        sendErrorMessage: '',
        lastSentAt: new Date().toISOString(),
        status: 'sent',
      })
      .commit()

    console.log(
      `[send-email] Successfully sent "${email.title}" via ${campaigns.length} campaign(s)`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await client
      .patch(docId)
      .set({sendState: 'error', sendErrorMessage: message.slice(0, 500)})
      .commit()
    console.error(`[send-email] Failed to send "${email.title}": ${message}`)
  }
})
