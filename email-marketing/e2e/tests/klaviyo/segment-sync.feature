Feature: Klaviyo Segment Sync
  Background:
    Given I am in the Studio

  Scenario: Sync button appears on the Klaviyo import page
    When I navigate to the Klaviyo sync section
    Then I see the "Sync with Klaviyo" button

  Scenario: Sync dialog confirms action before starting
    When I navigate to the Klaviyo sync section
    And I click the sync button
    Then a confirmation dialog appears

  Scenario: Sync displays progress while importing
    When I navigate to the Klaviyo sync section
    And I click the sync button
    And I confirm the sync
    Then a progress dialog appears
    And the dialog shows "Syncing with Klaviyo"

  Scenario: Successful sync shows segment count
    When I navigate to the Klaviyo sync section
    And I click the sync button
    And I confirm the sync
    And the sync completes successfully
    Then the dialog shows a segment count
    And segment documents exist in the dataset

  Scenario: Synced segments have enrichment fields editable
    Given segments exist in the dataset
    When I open a segment document
    Then the "Affinity Description" field is editable
    And the "Typical Copy Tone" field is editable
    And the "Engagement Tier" field is editable

  Scenario: Synced segment name and externalId are read-only
    Given segments exist in the dataset
    When I open a segment document
    Then the "Name" field is read-only
    And the "External ID" field is read-only
