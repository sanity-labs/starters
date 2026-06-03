import {
  DocumentTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LockIcon,
  PackageIcon,
  RocketIcon,
  TagIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

const REVIEWABLE_TYPES = ['helpArticle', 'faq', 'playbook', 'policy']

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Knowledge Base')
    .items([
      // Governance queue — makes the freshness problem legible on first open.
      S.listItem()
        .title('Needs Review')
        .icon(WarningOutlineIcon)
        .child(
          S.documentList()
            .title('Needs Review')
            .filter('_type in $types && defined(reviewByDate) && reviewByDate < now()')
            .params({types: REVIEWABLE_TYPES})
            .apiVersion('2025-03-01')
            .defaultOrdering([{field: 'reviewByDate', direction: 'asc'}]),
        ),
      S.divider(),

      // External content
      S.documentTypeListItem('helpArticle').title('Help Articles').icon(DocumentTextIcon),
      S.documentTypeListItem('faq').title('FAQs').icon(HelpCircleIcon),
      S.divider(),

      // Internal content
      S.documentTypeListItem('playbook').title('Playbooks').icon(RocketIcon),
      S.documentTypeListItem('policy').title('Policies').icon(LockIcon),
      S.divider(),

      // Shared taxonomy
      S.documentTypeListItem('product').title('Products').icon(PackageIcon),
      S.documentTypeListItem('topic').title('Topics').icon(TagIcon),
      S.documentTypeListItem('internalCategory').title('Internal Categories').icon(FolderIcon),
      S.divider(),

      // Agent Context configurations (external + internal)
      S.documentTypeListItem('sanity.agentContext').title('Agent Contexts'),
    ])
