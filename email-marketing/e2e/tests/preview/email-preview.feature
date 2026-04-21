Feature: Promotion Email Preview
  Scenario: Local preview renders email slots
    Given a promotion exists with email slots
    When I open the promotion preview at "/promotions/{id}"
    Then I see the slot content rendered
    And personalization tokens are replaced with sample data

  Scenario: Klaviyo preview toggle shows Klaviyo-format HTML
    Given a promotion exists with email slots
    When I open the promotion preview at "/promotions/{id}"
    And I click "Klaviyo preview"
    Then the iframe loads the Klaviyo render endpoint
    And the iframe shows the email HTML

  Scenario: Presentation Tool opens promotion preview
    Given I am in the Studio
    And a promotion exists with email slots
    When I open that promotion in the Studio
    And I open the Presentation Tool preview
    Then the preview pane shows the promotion at "/promotions/{id}"

  Scenario: Local preview view toggle defaults to local
    Given a promotion exists with email slots
    When I open the promotion preview at "/promotions/{id}"
    Then the "Local preview" toggle is active
    And the email slots are rendered as React components
