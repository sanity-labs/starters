import type {StructureResolver, DefaultDocumentNodeResolver} from 'sanity/structure'
import {
  ActivityIcon,
  ArchiveIcon,
  DocumentTextIcon,
  InfoOutlineIcon,
  RobotIcon,
  TagIcon,
  TrendUpwardIcon,
  UserIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import {PerformancePanel} from './components/PerformancePanel'

// GROQ that joins from the companion `articlePerformance` document back to the
// articles it scores — the same join used by the front-end intelligence
// features, expressed as Studio triage views.
const inTier = (expr: string) =>
  `_type == "article" && _id in *[_type == "articlePerformance" && ${expr}].article._ref`

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Analytics Content Ops')
    .items([
      S.listItem()
        .title('Articles')
        .icon(DocumentTextIcon)
        .child(S.documentTypeList('article').title('Articles')),
      S.documentTypeListItem('author').title('Authors').icon(UserIcon),
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),

      S.divider(),

      // ── Editorial triage views ──────────────────────────────────────────
      S.listItem()
        .title('Triage')
        .icon(WarningOutlineIcon)
        .child(
          S.list()
            .title('Triage')
            .items([
              S.listItem()
                .title('Needs Attention')
                .icon(WarningOutlineIcon)
                .child(
                  S.documentList()
                    .title('Needs Attention')
                    .filter(inTier('performanceTier == "stale" || lifecycleState == "declining"'))
                    .defaultOrdering([{field: 'publishedAt', direction: 'asc'}]),
                ),
              S.listItem()
                .title('Trending Now')
                .icon(TrendUpwardIcon)
                .child(
                  S.documentList()
                    .title('Trending Now')
                    .filter(inTier('performanceTier == "trending"'))
                    .defaultOrdering([{field: 'publishedAt', direction: 'desc'}]),
                ),
              S.listItem()
                .title('Archive Candidates')
                .icon(ArchiveIcon)
                .child(
                  S.documentList()
                    .title('Archive Candidates')
                    .filter(inTier('lifecycleState == "archive_candidate"')),
                ),
              S.divider(),
              S.listItem()
                .title('Content Agent Queue')
                .icon(RobotIcon)
                .child(
                  S.documentList()
                    .title('Content Agent Queue')
                    .filter(
                      '_type == "article" && agentReview.status in ["queued", "in_progress", "staged"]',
                    )
                    .defaultOrdering([{field: 'agentReview.reviewedAt', direction: 'desc'}]),
                ),
            ]),
        ),

      S.divider(),

      // ── Sync-owned data (read-only) ──────────────────────────────────────
      S.listItem()
        .title('Performance data')
        .icon(ActivityIcon)
        .child(S.documentTypeList('articlePerformance').title('Performance data')),
      S.listItem()
        .title('Analytics context')
        .icon(InfoOutlineIcon)
        .child(S.document().schemaType('analyticsContext').documentId('analyticsContext')),
    ])

// Attach the read-only Performance panel as a second view on every article, so
// authors and editors see the signal without leaving the document form.
export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) => {
  if (schemaType === 'article') {
    return S.document().views([
      S.view.form(),
      S.view.component(PerformancePanel).title('Performance').icon(TrendUpwardIcon),
    ])
  }
  return S.document()
}
