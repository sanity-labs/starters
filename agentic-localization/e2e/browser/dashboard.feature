@requires-auth
Feature: The translations dashboard

  The dashboard is a Sanity App, not a Studio: it authenticates through the App
  SDK, which trades a stamped token on sanity.io rather than reading one from
  local storage. An automated browser has no way to complete that exchange, so
  every scenario here is written and skipped, and the run says so.

  The journey exists anyway. The gap is the point: the dashboard is the only
  surface that starts a drafts-scoped run, and a suite that quietly omitted it
  would read as coverage it does not have.

  Background:
    Given the dashboard is open

  Scenario: The dashboard names itself and its viewer
    Then the page heading is "Sanity Translations Dashboard"
    And the dashboard greets the signed-in user

  Scenario: The dashboard breaks translations down by status
    Then the dashboard shows a status card per translation status

  Scenario: The dashboard plots coverage per type and locale
    Then the page heading is "Translation Coverage"
    And every heatmap cell reports a percentage
