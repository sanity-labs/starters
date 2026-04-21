Feature: Promotion Workflow State Transitions
  Background:
    Given I am in the Studio
    And a promotion exists in "draft" status

  Scenario: Draft promotion shows Approve action
    When I open that promotion
    Then I see the "Approve" action button
    And the workflow badge shows "draft"

  Scenario: Approving a promotion transitions state to approved
    When I open that promotion
    And I click "Approve"
    And I confirm the approval dialog
    Then the workflow badge shows "approved"

  Scenario: Approved promotion shows Resend action
    Given a promotion exists in "approved" status
    When I open that promotion
    Then I see the "Resend" action button

  Scenario: Preview Status inspector shows token accuracy
    When I open that promotion
    And I open the "Preview Status" inspector panel
    Then I see the workflow history section
    And I see the preview accuracy indicator

  Scenario: Segment badge displays on promotion
    Given a promotion exists targeting a named segment
    When I open that promotion
    Then the segment name appears as a document badge

  Scenario: Workflow state badge reflects current status
    When I open that promotion
    Then the document has a badge showing "draft"
