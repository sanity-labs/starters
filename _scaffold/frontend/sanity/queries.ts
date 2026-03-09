import { defineQuery } from "next-sanity";

export const allPostsQuery = defineQuery(`
  *[_type == "post" && defined(slug.current)] | order(_createdAt desc) {
    _id,
    title,
    "slug": slug.current,
  }
`);

export const postQuery = defineQuery(`
  *[_type == "post" && slug.current == $slug] [0] {
    _id,
    title,
    "slug": slug.current,
    body,
  }
`);

export const postSlugsQuery = defineQuery(`
  *[_type == "post" && defined(slug.current)]
  {"slug": slug.current}
`);
