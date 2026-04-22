import type {StructureResolver} from 'sanity/structure'
import {
  RocketIcon,
  BasketIcon,
  FilterIcon,
  SyncIcon,
  SquareIcon,
  CogIcon,
  BoltIcon,
  CommentIcon,
} from '@sanity/icons'
import {CampaignGridView} from './plugins/campaign'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Email Marketing')
    .items([
      S.listItem()
        .title('Campaigns')
        .icon(RocketIcon)
        .child(
          S.list()
            .title('Campaigns')
            .items([
              S.listItem()
                .title('Email Settings')
                .icon(CogIcon)
                .child(
                  S.list()
                    .title('Email Settings')
                    .items([
                      S.listItem()
                        .title('Brand Voice')
                        .icon(CommentIcon)
                        .child(S.document().documentId('brandVoice').schemaType('brandVoice')),
                      S.listItem()
                        .title('Urgency Stages')
                        .icon(BoltIcon)
                        .child(S.documentTypeList('urgencyStage').title('Urgency Stages')),
                    ]),
                ),
              S.divider(),
              S.listItem()
                .title('All Campaigns')
                .icon(RocketIcon)
                .child(
                  S.documentTypeList('campaign')
                    .title('All Campaigns')
                    .child((id) =>
                      S.document()
                        .documentId(id)
                        .schemaType('campaign')
                        .views([
                          S.view.form().title('Brief'),
                          S.view.component(CampaignGridView).title('Promotions').icon(SquareIcon),
                        ]),
                    ),
                ),
            ]),
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
