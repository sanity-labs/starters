import type {StructureResolver} from 'sanity/structure'
import {RocketIcon, BasketIcon, UsersIcon, FilterIcon, SyncIcon, CogIcon} from '@sanity/icons'

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
            .child((campaignId) =>
              S.list()
                .title('Campaign')
                .items([
                  S.listItem()
                    .title('Details')
                    .icon(RocketIcon)
                    .child(S.document().documentId(campaignId).schemaType('campaign')),
                  S.listItem()
                    .title('Emails')
                    .child(
                      S.documentTypeList('emailMessage')
                        .title('Emails')
                        .filter('_type == "emailMessage" && campaign._ref == $campaignId')
                        .params({campaignId})
                        .initialValueTemplates([
                          S.initialValueTemplateItem('emailMessage-for-campaign', {campaignId}),
                        ]),
                    ),
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
                .title('Import')
                .icon(SyncIcon)
                .child(S.document().documentId('klaviyoImport').schemaType('klaviyoImport')),
              S.listItem()
                .title('Lists')
                .icon(UsersIcon)
                .child(S.documentTypeList('list').title('Lists').menuItems([])),
              S.listItem()
                .title('Segments')
                .icon(FilterIcon)
                .child(S.documentTypeList('segment').title('Segments').menuItems([])),
            ]),
        ),
      S.divider(),
      S.listItem()
        .title('Email Settings')
        .icon(CogIcon)
        .child(S.document().documentId('emailSettings').schemaType('emailSettings')),
    ])
