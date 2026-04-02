import {defineQuery} from 'next-sanity'

export const allCampaignsQuery = defineQuery(`
  *[_type == "campaign" && defined(slug.current)] | order(_createdAt desc) {
    _id,
    title,
    "slug": slug.current,
    status,
    description,
    list->{name},
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
    list->{name, description},
    audiences[]->{_id, name, description},
    "emails": *[_type == "emailMessage" && campaign._ref == ^._id] | order(_createdAt asc) {
      _id,
      title,
      subject,
      preheader,
      status,
      audience->{_id, name},
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
    campaign->{_id, title, "slug": slug.current, list->{name}},
    audience->{name, behaviorNotes},
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
