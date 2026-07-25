Feature: Publishing a source document runs it through to an approved localization

  The happy path, end to end: the publish Function opens a run, the analysis
  decides which markets it affects, one child run translates each of them, and a
  reviewer approves the whole document once. The source is held from publishing
  for exactly as long as the run owns it.

  Background:
    Given a published article

  Scenario: A publish opens a run parked on its analysis
    When the publish event is delivered
    Then the run is in the "analyzing" stage
    And the "analyze-source" effect is pending

  Scenario: A material analysis fans out one child run per affected locale
    Given the publish event is delivered
    When the analysis reports a material change to "de-DE, fr-FR"
    Then the run is in the "translating" stage
    And the run has 2 locale children for "de-DE, fr-FR"
    And a publish guard holds the source

  Scenario: The cohort gate holds the run until every locale has settled
    Given the publish event is delivered
    And the analysis reports a material change to "de-DE, fr-FR"
    When the "de-DE" locale translation succeeds
    Then the run is in the "translating" stage
    When every remaining locale translation succeeds
    Then the run is in the "review" stage
    And no locale is flagged as failed
    And a publish guard holds the source

  Scenario: Approving the review completes the run and releases the source
    Given the publish event is delivered
    And the analysis reports a material change to "de-DE, fr-FR"
    And every remaining locale translation succeeds
    When the reviewer approves
    Then the run is in the "approved" stage
    And the approval records the reviewer
    And no guard holds the source

  Scenario: A cosmetic edit finishes without a person or a child run
    Given the publish event is delivered
    When the analysis reports a cosmetic change affecting no locales
    Then the run is in the "done" stage
    And the run has no locale children
    And no guard holds the source

  Scenario: Deleting the source aborts its run and releases the hold
    Given the publish event is delivered
    And the analysis reports a material change to "de-DE, fr-FR"
    When the source document is deleted
    Then the run is aborted with the reason "Subject deleted"
    And no guard holds the source
