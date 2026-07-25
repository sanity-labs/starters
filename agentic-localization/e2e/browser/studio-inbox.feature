Feature: The Localization inbox in the Studio structure

  Run state lives in the workflows dataset, so no content list can show it. The
  inbox is built from ids the engine names, which is why its counts and its rows
  come from two different reads — and why "the count matches the rows" is the
  invariant worth holding: a section that promises three and lists two is a
  reader-model bug that no unit test would catch.

  Background:
    Given the Studio structure is open
    And the editor opens the Localization group

  Scenario: The inbox asks the four questions the engine can answer
    Then the inbox has a "Needs review" section
    And the inbox has a "Translating" section
    And the inbox has a "Source changed" section
    And the inbox has a "Failed locales" section

  Scenario Outline: A section lists exactly as many runs as its title counts
    When the editor enters the "<section>" section
    Then the section lists as many runs as its title counted

    Examples:
      | section        |
      | Needs review   |
      | Translating    |
      | Source changed |
      | Failed locales |

  @requires-open-run
  Scenario: A run row opens its document with the inspector available
    When the editor enters the first section holding a run
    And the editor opens the first run in the section
    Then a document pane is open
    When the reviewer opens the Translations inspector
    Then the inspector is open
