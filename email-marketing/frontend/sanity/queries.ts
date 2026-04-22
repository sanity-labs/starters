import {defineQuery} from 'next-sanity'
import 'sanity-types'

export const allCampaignsQuery = defineQuery(`
  *[_type == "campaign"] | order(_createdAt desc) {
    _id,
    title,
    startDate,
    endDate,
    emotionalGoal,
    toneTraits,
    "urgencyStage": urgencyStage->{title},
    "segments": segments[]->{_id, name, engagementTier},
    "promotionCount": count(*[_type == "promotion" && campaign._ref == ^._id]),
    "approvedCount": count(*[_type == "workflow.state" && status == "approved" && promotionId._ref in *[_type == "promotion" && campaign._ref == ^._id]._id]),
  }
`)

export const promotionsByCampaignQuery = defineQuery(`
  *[_type == "promotion" && campaign._ref == $campaignId] | order(_createdAt asc) {
    _id,
    subjectLine,
    preheader,
    disruptor,
    "segment": segment->{_id, name, engagementTier},
    "workflowStatus": *[_type == "workflow.state" && promotionId._ref == ^._id][0].status,
  }
`)

export const promotionByIdQuery = defineQuery(`
  *[_type == "promotion" && _id == $id][0] {
    _id,
    subjectLine,
    preheader,
    disruptor,
    emailSlots[] {
      _key,
      position,
      headline,
      subheadline,
      asset,
      cta,
    },
    "campaign": campaign->{_id, title, primaryMessage, previewContext},
    "segment": segment->{_id, name, affinityDescription, typicalCopyTone},
    "workflowStatus": *[_type == "workflow.state" && promotionId._ref == ^._id][0].status,
    campaignPerformance,
  }
`)
