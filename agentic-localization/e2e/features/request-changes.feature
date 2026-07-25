Feature: A reviewer sends one locale back for another pass

  Requesting changes narrows the next cohort to the locales the reviewer named
  and carries their note into the prompt for exactly those runs. The markets the
  reviewer accepted are not retranslated, and are not billed for again.

  Background:
    Given a published article
    And the publish event is delivered
    And the analysis reports a material change to "de-DE, fr-FR"
    And every remaining locale translation succeeds

  Scenario: Requesting changes for one locale redoes only that locale
    When the reviewer requests changes to "de-DE" with the note "Warmer tone, keep the product name verbatim"
    Then the run is in the "translating" stage
    And exactly 1 locale child is awaiting translation, for "de-DE"
    And the awaiting locale child carries the revision note "Warmer tone, keep the product name verbatim"

  Scenario: The redone locale returns the run to review with a clean verdict
    Given the reviewer requests changes to "de-DE" with the note "Too formal"
    When every remaining locale translation succeeds
    Then the run is in the "review" stage
    And no locale is flagged as failed

  Scenario: Approving after the second pass completes the run
    Given the reviewer requests changes to "de-DE" with the note "Too formal"
    And every remaining locale translation succeeds
    When the reviewer approves
    Then the run is in the "approved" stage
    And the approval records the reviewer
    And no guard holds the source
