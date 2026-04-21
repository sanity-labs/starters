Feature: Generate Variants Document Action
  Background:
    Given I am in the Studio
    And I open a campaign document

  Scenario: Generate Variants button is present on campaign
    Then I see the "Generate Variants" action button

  Scenario: Generate Variants is disabled when campaign has no content
    Given the campaign has no primary message
    Then the "Generate Variants" button is disabled

  Scenario: Generate Variants shows progress dialog
    Given the campaign has segments and a primary message
    When I click "Generate Variants"
    Then a progress dialog appears
    And the dialog shows generation progress text

  Scenario: Generated promotions appear in the Variants tab
    Given the campaign has segments and a primary message
    When I click "Generate Variants"
    And the generation completes
    And I switch to the "Variants" tab
    Then I see promotion tiles for the base and each segment

  Scenario: Each generated promotion has workflow state draft
    Given the campaign has segments and a primary message
    When I click "Generate Variants"
    And the generation completes
    Then each created promotion has a workflow state of "draft"
