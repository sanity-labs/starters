Feature: An approved run teaches the next one

  The self-reinforcing loop: use generates context. When a reviewer approves a
  localization, `distill-review` diffs the machine draft against the text they
  actually shipped and writes DRAFT proposals for a human to accept. It is an
  observer of finished runs — nothing it does can fail a localization — and it
  spends nothing when the machine got it right.

  Mode H: the real handlers and the real Function, with only the two Agent
  Actions canned.

  Background:
    Given the locales "en-US, de-DE"
    And a published profile
    And the publish event is delivered
    And the effect handlers drain the run

  Scenario: A reviewer's corrections become a draft glossary proposal
    Given the reviewer corrects two words in the "de-DE" bio
    And the reviewer approves
    When the approved run is distilled
    Then a draft "glossary-term" proposal exists for "de-DE"
    And the proposal quotes the machine text beside the text that was approved
    And the distillation record reports 1 proposal from 1 AI call

  Scenario: An unedited approval is harvested as a free eval case
    Given the reviewer approves
    When the approved run is distilled
    Then a draft "eval-case" proposal exists for "de-DE"
    And the eval case records the revision the machine wrote
    And no AI call was spent on the distillation
    And the distillation record reports 1 proposal from 0 AI calls

  Scenario: A redelivered event distils the same run only once
    Given the reviewer corrects two words in the "de-DE" bio
    And the reviewer approves
    And the approved run is distilled
    When the approved run is distilled
    Then exactly 1 proposal exists
    And exactly 1 AI call was spent in total
