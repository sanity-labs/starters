@requires-sample-data
Feature: A reviewer reads a document-tier translation in the Studio

  The article tier keeps one document per locale, so reviewing means comparing a
  source against its siblings. The inspector is where that happens: a locale by
  field matrix, a detail pane that defers the long diffs, and an affordance that
  puts a translation on screen beside its source.

  "The changed locale" is not a code these scenarios pin. The matrix reports a
  locale as changed while its pending revision differs from its published one,
  which is run state: the row carrying a diff now is quiet an hour later and
  another row has taken its place. `browser/fixture.ts` reads whichever row the
  grid currently reports, and the steps click that.

  Everything here reads the dev dataset. The two review verbs do not — firing an
  engine action needs a session the automated browser cannot obtain — so they
  are written and tagged, and the run reports the reason the inspector gave.

  Background:
    Given the Studio is open on the "article" document "article-simultaneous-global-launch"
    And the reviewer opens the Translations inspector

  Scenario: The inspector opens on the source document
    Then the inspector is open
    And the matrix has a row for every configured target locale

  Scenario: The grid reports a coverage state for every locale and field
    When the matrix is shown as a grid
    Then every cell reports one of the documented coverage states
    And the legend names "Unchanged, Minor, Updated, Rewritten, Missing"

  @requires-changed-locale
  Scenario: Selecting a changed cell opens the diff a row selection defers
    When the matrix is shown as a grid
    And the reviewer selects the changed locale's row
    Then the detail pane names the changed locale
    And the detail pane keeps at least one long diff behind a toggle
    When the reviewer selects the changed locale's cell for "body"
    Then the detail pane offers to edit "body"
    And fewer long diffs are behind a toggle than before

  @requires-changed-locale
  Scenario: A row opens its translation beside the source
    When the reviewer opens the changed locale's document from its row
    Then a further document pane opens beside the source
    And the new pane holds a different document

  @requires-auth
  Scenario: The reviewer approves the run
    When the reviewer fires "Approve"
    Then the review verb is accepted

  @requires-auth @requires-changed-locale
  Scenario: The reviewer requests changes to one locale
    When the reviewer fires "Request changes"
    Then the request-changes dialog is open
    When the reviewer notes "Tighten the headline" and picks the changed locale
    Then the dialog offers to redo 1 locale
