@requires-auth
Feature: The translations dashboard

  The dashboard is a Sanity App, not a Studio — but standalone (outside a
  dashboard iframe) the App SDK reads the same `{token}` shape from
  `localStorage["__sanity_auth_token"]`, so the suite's injected token logs it
  in. Only inside a real sanity.io dashboard iframe does auth become a
  stamped-token exchange no automated browser can complete; the gate reports
  that case and these scenarios skip.

  Background:
    Given the dashboard is open

  Scenario: The dashboard names itself and its viewer
    Then the page heading is "Sanity Translations Dashboard"
    And the dashboard greets the signed-in user

  Scenario: The dashboard breaks translations down by status
    Then the dashboard shows a status card per translation status

  Scenario: The dashboard plots coverage per type and locale
    Then the "Coverage Heatmap" section is announced to assistive tech
    And every heatmap cell reports a percentage
