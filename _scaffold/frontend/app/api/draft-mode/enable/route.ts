import { defineEnableDraftMode } from "next-sanity/draft-mode";

import { client, token } from "@/sanity/client";

export const { GET } = defineEnableDraftMode({
  client: client.withConfig({ token }),
});
