/**
 * Shared prompt instruction for AI stale change analysis.
 *
 * Used by both the Sanity Function (T2) and client-side fallback (T3).
 *
 * The `$fieldSummary` placeholder is replaced at runtime with the output
 * of `buildFieldSummary()` — tiered content by field type.
 */

export const ANALYSIS_PROMPT_INSTRUCTION = `You are analyzing changes to a source document that has translations in multiple languages.
The source document was edited after translations were created. Your job is to assess whether
the translations need updating.

The following fields changed between the version used for translation and the current version.
For text fields, the old and new values are shown so you can assess the actual content change:

$fieldSummary

Respond with a JSON object (no markdown fences, no explanation outside the JSON):
{
  "materiality": "<one of: cosmetic, minor, material>",
  "explanation": "1-2 sentences maximum. State what changed using the document's actual content terms (e.g., 'the article title year was updated and the summary was completely rewritten' not 'the body field was modified'), then whether translations need updating. Be direct — editors scan this, they don't study it.",
  "suggestions": [
    {
      "fieldName": "exact field name from the list above",
      "explanation": "1-2 sentences about what changed in this field and why it matters for translations",
      "changeSummary": "A single short sentence describing the change in plain language for a non-technical editor, e.g. 'The year changed from 2027 to 2026' or 'A new call-to-action sentence was added'. Must not use technical terms like 'field', 'block', 'node', or 'diff'.",
      "reasonCode": "<one of: fact_changed, cta_changed, tone_only, formatting_only, content_added, content_removed, date_or_number_changed, other>",
      "impactTags": ["1-3 short labels editors see as chips, e.g. 'Fact changed', 'CTA added', 'Year updated', 'Tone only'. Use the document's own terms where possible."],
      "recommendation": "<one of: retranslate, dismiss>"
    }
  ]
}

Materiality levels:
- "cosmetic": No semantic change. If a translator saw the old and new source side by side, they would not change their translation. Examples: whitespace cleanup, punctuation normalization, formatting-only edits, reordering without content change. ALL suggestions should recommend "dismiss".
- "minor": Small wording tweaks that don't change core meaning. A translator might tweak a word or two but the overall translation remains valid. Examples: typo fixes, synonym swaps, minor rephrasing for clarity. Most suggestions should recommend "dismiss" unless the wording change affects a key term or brand name.
- "material": Meaningful content change. A translator would need to substantially revise or redo their translation. Examples: new paragraphs, rewritten sections, changed facts/figures, added or removed information, altered calls to action. Suggestions for changed content fields should recommend "retranslate".

Reason codes (for reasonCode field):
- "fact_changed": A factual detail changed (dates, numbers, names, statistics, pricing).
- "cta_changed": A call to action was added, removed, or reworded.
- "tone_only": Wording changed but the meaning is the same (synonym swaps, rephrasing for clarity).
- "formatting_only": Whitespace, punctuation, or structural formatting changed with no semantic impact.
- "content_added": New content was inserted (paragraphs, sentences, sections).
- "content_removed": Existing content was deleted.
- "date_or_number_changed": A date, year, or numeric value changed.
- "other": None of the above apply.

Rules:
- Include a suggestion for EVERY changed field — do not skip any.
- fieldName must exactly match a field name from the list above. Only include fields that appear in the list above. Do not invent or guess field names.
- changeSummary must be written for a non-technical content editor. Describe the change using the document's actual words, not implementation terms. Never say "field", "block", "node", or "diff".
- impactTags should be 1-3 short labels (2-4 words each) that help an editor quickly understand why this matters. Use the document's own content terms where possible (e.g. "Year updated" not "Number changed").
- For Portable Text fields (body, content, etc.), read the change regions showing what was removed and added with surrounding context. Describe what content changed in terms a translator would use (e.g., "the pricing section was rewritten with new tier names" not "3 blocks modified"). Reference specific content from the changes in your explanation.
- Non-content fields (slugs, image references, metadata) should almost always recommend "dismiss" — they typically don't need re-translation. For example, a slug change never requires re-translation.
- When in doubt between "minor" and "material", choose "material" — it's safer to re-translate than to miss a meaningful change.
- The magnitude label (minor/updated/rewritten) is a rough heuristic based on text length changes — not a semantic assessment. Override it with your own judgment based on the actual content. A single changed number, date, or name can be "material" even if labeled "minor change."`
