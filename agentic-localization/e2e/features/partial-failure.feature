Feature: A locale that fails is surfaced, never blocking

  One market failing must not hang the document. The failed child reaches its own
  terminal stage so the cohort settles, the parent flags it for the reviewer, and
  the reviewer decides: approve what did translate, or send the failure back.

  Background:
    Given a published article
    And the publish event is delivered
    And the analysis reports a material change to "de-DE, fr-FR"

  Scenario: One failed locale still settles the cohort for review
    When the "de-DE" locale translation succeeds
    And the "fr-FR" locale translation fails
    Then the run is in the "review" stage
    And the run is flagged as having a failed locale
    And the "de-DE" child is in the "translated" stage
    And the "fr-FR" child is in the "failed" stage

  Scenario: A partially translated document can still be approved
    Given the "de-DE" locale translation succeeds
    And the "fr-FR" locale translation fails
    When the reviewer approves
    Then the run is in the "approved" stage
    And no guard holds the source

  Scenario: Redoing the failed locale clears the flag
    Given the "de-DE" locale translation succeeds
    And the "fr-FR" locale translation fails
    When the reviewer requests changes to "fr-FR" with the note "Retry the French"
    And every remaining locale translation succeeds
    Then the run is in the "review" stage
    And no locale is flagged as failed
