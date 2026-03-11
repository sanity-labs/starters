import {defineQuery} from 'next-sanity'

export const allEmailsQuery = defineQuery(`
  *[_type == "emailMessage"] | order(_createdAt desc) {
    _id,
    title,
    subject,
    status,
    "campaigns": *[_type == "campaign" && email._ref == ^._id]{title},
  }
`)

export const emailByIdQuery = defineQuery(`
  *[_type == "emailMessage" && _id == $id] [0] {
    _id,
    title,
    subject,
    preheader,
    status,
    "campaigns": *[_type == "campaign" && email._ref == ^._id]{
      _id,
      title,
      lists[]->{name},
      includedSegments[]->{_id, name, behaviorNotes},
      excludedSegments[]->{_id, name},
    },
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
