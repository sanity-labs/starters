import {
  DocumentTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LockIcon,
  PackageIcon,
  TagIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Knowledge Base')
    .items([
      S.listItem()
        .title('Needs Review')
        .icon(WarningOutlineIcon)
        .child(
          S.documentList()
            .title('Needs Review')
            .filter('_type == "policy" && defined(reviewByDate) && reviewByDate < now()')
            .apiVersion('2025-03-01')
            .defaultOrdering([{field: 'reviewByDate', direction: 'asc'}]),
        ),
      S.divider(),
      S.documentTypeListItem('helpArticle').title('Help Articles').icon(DocumentTextIcon),
      S.documentTypeListItem('faq').title('FAQs').icon(HelpCircleIcon),
      S.divider(),
      S.documentTypeListItem('policy').title('Policies').icon(LockIcon),
      S.divider(),
      S.documentTypeListItem('product').title('Products').icon(PackageIcon),
      S.documentTypeListItem('topic').title('Topics').icon(TagIcon),
      S.documentTypeListItem('internalCategory').title('Internal Categories').icon(FolderIcon),
    ])
