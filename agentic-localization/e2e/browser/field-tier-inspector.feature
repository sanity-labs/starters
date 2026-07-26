@requires-sample-data
Feature: A field-tier profile's coverage in the Translations inspector

  A profile keeps every locale inside its own internationalized arrays, so there
  is no sibling document to open — coverage is a property of the fields. The
  inspector renders the same matrix as the document tier with the tier as a
  prop, which is exactly what makes this worth asserting separately: three
  columns, one per internationalized field, and a coverage state per cell.

  "The changed locale" is whichever locale the grid currently reports a `bio`
  change for, read by `browser/fixture.ts` — never a pinned code, because which
  locale has something to read moves with the runs.

  Background:
    Given the Studio is open on the "person" document "person-elena-vasquez"
    And the reviewer opens the Translations inspector

  Scenario: The grid has one column per internationalized field
    Then the grid columns are "bio, seo.metaTitle, seo.metaDescription"

  Scenario: Every target locale reports a coverage state for every field
    Then the matrix has a row for every configured target locale
    And every cell reports one of the documented coverage states
    And the legend names "Unchanged, Minor, Updated, Rewritten, Missing"

  @requires-changed-locale
  Scenario: Selecting a field cell shows what that locale holds
    When the reviewer selects the changed locale's cell for "bio"
    Then the detail pane names the changed locale
    And the detail pane offers to edit "bio"
