import {defineQuery} from 'next-sanity'

export const allCampaignsQuery = defineQuery(`
  *[_type == "campaign" && defined(slug.current)] | order(_createdAt desc) {
    _id,
    title,
    "slug": slug.current,
    status,
    description,
    lists[]->{name},
    "emailCount": count(*[_type == "emailMessage" && campaign._ref == ^._id]),
  }
`)

export const campaignSlugsQuery = defineQuery(`
  *[_type == "campaign" && defined(slug.current)]
  {"slug": slug.current}
`)

export const campaignBySlugQuery = defineQuery(`
  *[_type == "campaign" && slug.current == $slug] [0] {
    _id,
    title,
    "slug": slug.current,
    status,
    description,
    lists[]->{name, description},
    includedSegments[]->{_id, name, description},
    excludedSegments[]->{_id, name, description},
    "emails": *[_type == "emailMessage" && campaign._ref == ^._id] | order(_createdAt asc) {
      _id,
      title,
      subject,
      preheader,
      status,
      includedSegments[]->{_id, name},
      excludedSegments[]->{_id, name},
    },
  }
`)

export const emailByIdQuery = defineQuery(`
  *[_type == "emailMessage" && _id == $id] [0] {
    _id,
    title,
    subject,
    preheader,
    status,
    campaign->{_id, title, "slug": slug.current, lists[]->{name}},
    includedSegments[]->{name, behaviorNotes},
    excludedSegments[]->{name},
    sendState,
    lastSentAt,
    body[] {
      ...,
      _type == "emailSection" => {
        ...,
        "imageUrl": image.asset->url,
        products[]->{
          _id,
          title,
          price,
          description,
          url,
          "imageUrl": image.asset->url,
        },
      },
      _type == "emailHeader" => {
        ...,
        "logoImageUrl": logoUrl.asset->url,
      },
    },
  }
`)
