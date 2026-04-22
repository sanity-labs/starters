Feature: Campaign to Send — Full Content Operations Narrative
  The complete workflow: create campaign brief → generate promotions → refine → approve → send

  Scenario: Generate promotions from a campaign brief
    Given I am in the Studio
    When I open a campaign document
    And I fill in the primary message with "Summer collection launch for young women aged 18-30"
    And I click "Generate Promotions"
    And the generation completes
    Then I see a promotion for each target segment

  Scenario: Approve a promotion and trigger send
    Given I am in the Studio
    And a promotion exists in "draft" status
    When I open that promotion
    And I click "Approve"
    And I confirm the approval dialog
    Then the workflow state transitions to "approved"
    And the on-promotion-approved function dispatches to Klaviyo

  Scenario: Variant Refinement panel refines copy via content agent
    Given I am in the Studio
    And a promotion exists in "draft" status
    When I open that promotion
    And I open the "Refine with AI" inspector panel
    And I type "Make the subject line shorter and more urgent"
    And I send the message
    Then the agent responds with a suggestion
    And the promotion draft is updated

  Scenario: Campaign Grid view shows all promotions side by side
    Given I am in the Studio
    When I open a campaign document with existing promotions
    And I switch to the "Promotions" tab
    Then I see one tile per segment promotion
    And each tile shows the subject line and workflow status

  Scenario: Segment sync populates segments available for campaign targeting
    Given I am in the Studio
    When I navigate to the Klaviyo sync section
    And I click "Sync with Klaviyo"
    And I confirm the sync dialog
    And the sync completes
    Then segment documents appear in the segments list
    And they can be referenced in a campaign's segments field
