import type {StructureResolver} from 'sanity/structure'
import {RocketIcon, BasketIcon, FilterIcon, SyncIcon, SquareIcon} from '@sanity/icons'
import {CampaignGridView} from './plugins/campaign'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Email Marketing')
    .items([
      S.listItem()
        .title('Campaigns')
        .icon(RocketIcon)
        .child(
          S.documentTypeList('campaign')
            .title('Campaigns')
            .child((id) =>
              S.document()
                .documentId(id)
                .schemaType('campaign')
                .views([
                  S.view.form().title('Brief'),
                  S.view.component(CampaignGridView).title('Variants').icon(SquareIcon),
                ]),
            ),
        ),
      S.divider(),
      S.listItem()
        .title('Products')
        .icon(BasketIcon)
        .child(S.documentTypeList('product').title('Products')),
      S.divider(),
      S.listItem()
        .title('Klaviyo')
        .icon(SyncIcon)
        .child(
          S.list()
            .title('Klaviyo')
            .items([
              S.listItem()
                .title('Sync / Import')
                .icon(SyncIcon)
                .child(S.document().documentId('klaviyoImport').schemaType('klaviyoImport')),
              S.listItem()
                .title('Segments')
                .icon(FilterIcon)
                .child(S.documentTypeList('segment').title('Segments').menuItems([])),
            ]),
        ),
    ])
