import groq from 'groq'

export const settingsQuery = groq`*[_type == "settings"][0]{
  title,
  description,
  logo
}`

export const allPostsQuery = groq`*[_type == "post" && defined(slug.current)] | order(publishedAt desc, _createdAt desc) {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  coverImage
}`

export const postBySlugQuery = groq`*[_type == "post" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  coverImage,
  body,
  author->{name, "slug": slug.current, image}
}`

export const postSlugsQuery = groq`*[_type == "post" && defined(slug.current)]{"slug": slug.current}`
