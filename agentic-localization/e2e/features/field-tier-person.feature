Feature: A field-tier profile localizes in place

  A profile keeps every locale inside its own internationalized arrays, so its
  locale children write into the document they were started from. The real effect
  handlers run here — only the two Agent Actions are canned — which is what makes
  the write paths, the read perspective and the no-restart invariant provable.

  Background:
    Given the locales "en-US, de-DE"

  Scenario: A published profile opens a run that reads the published layer
    Given a published profile
    When the publish event is delivered
    Then the run is in the "analyzing" stage
    And the run reads the "published" perspective
    And the "analyze-source" effect is pending

  Scenario: The handlers write every locale into the profile's own draft
    Given a published profile
    And the publish event is delivered
    When the effect handlers drain the run
    Then the run is in the "review" stage
    And the profile draft carries "de-DE" values for every internationalized field
    And no second profile document was created
    And no translation.metadata document was created
    And every locale child recorded the revision it wrote

  Scenario: The first analysis of a fresh profile spends no AI call
    Given a published profile
    And the publish event is delivered
    When the analysis alone drains
    Then no AI call was spent

  Scenario: Republishing an approved profile starts no further translation
    Given a published profile
    And the publish event is delivered
    And the effect handlers drain the run
    And the reviewer approves
    When the profile is republished
    And the effect handlers drain the run
    Then the run is in the "done" stage
    And the run has no locale children
    And no AI call was spent

  Scenario: A profile with no source content fails its locale and spends nothing
    Given a published profile with no source content
    And the publish event is delivered
    When the effect handlers drain the run
    Then the run is in the "review" stage
    And the run is flagged as having a failed locale
    And no AI call was spent
