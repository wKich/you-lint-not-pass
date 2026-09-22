# Spec Delta

## Purpose

Enforce repo-wide lint policy on file writes: shield protected lint configuration files from modification and prevent AI agents from adding inline suppression comments, across every host integration and payload shape the system accepts, including multi-file patch operations.

## ADDED Requirements

### Requirement: Protected lint configuration files are shielded from modification

The system SHALL deny any write operation whose target path resolves to a protected lint configuration file (oxlint, ESLint, or Biome config names) at the project root, with a reason explaining that the lint policy is protected.

#### Scenario: Write to a protected config is denied

- **WHEN** a write tool call targets `.oxlintrc.json` at the project root
- **THEN** the operation is denied and the reason names the protected file

#### Scenario: Edit of a protected config is denied

- **WHEN** an edit tool call targets `eslint.config.js`
- **THEN** the operation is denied and the reason names the protected file

#### Scenario: Unrelated files are not affected by config protection

- **WHEN** a write tool call targets a file that is not a protected lint config
- **THEN** the operation is not denied by the config-protection requirement

### Requirement: Patch operations may not delete, rename, or redirect protected configs

The system SHALL deny a patch operation when any of its file sections has a source or destination path that resolves to a protected lint configuration file, including `Delete File` sections and `Update File` sections carrying a `Move to` destination.

#### Scenario: Deleting a protected config via patch is denied

- **WHEN** a patch contains a `Delete File` section for `.oxlintrc.json`
- **THEN** the entire patch operation is denied and the reason names the protected file

#### Scenario: Moving a file onto a protected config path is denied

- **WHEN** a patch contains an `Update File` section whose `Move to` destination is `biome.json`
- **THEN** the entire patch operation is denied and the reason names the protected file

#### Scenario: Renaming a protected config away is denied

- **WHEN** a patch contains an `Update File` section whose source path is `.oxlintrc.json` and whose `Move to` destination is another path
- **THEN** the entire patch operation is denied and the reason names the protected file

### Requirement: Inline suppression comments may not be added by write or edit

The system SHALL deny a write or edit operation on a commentable source file (`.js`, `.jsx`, `.ts`, `.tsx`, and module variants) when the resulting content contains more occurrences of any suppression marker (`eslint-disable`, `eslint-enable`, `oxlint-disable`, `oxlint-enable`, `biome-ignore`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, including their `-next-line`/`-line`/`-all`/`-start`/`-end` variants) than the existing content. Operations that only remove suppression markers SHALL be allowed.

#### Scenario: Adding a suppression comment is denied

- **WHEN** an edit tool call adds a `// @ts-ignore` comment to a TypeScript file
- **THEN** the operation is denied and the blocked marker is named in the reason

#### Scenario: Removing a suppression comment is allowed

- **WHEN** an edit tool call deletes an existing `// eslint-disable-next-line` comment
- **THEN** the operation is allowed

#### Scenario: Rewriting without adding suppressions is allowed

- **WHEN** a write tool call replaces a source file whose suppression-marker count does not increase
- **THEN** the operation is allowed

### Requirement: Suppression markers in patch additions are denied

The system SHALL deny a patch operation when any `+`-prefixed added line in any file section contains a suppression marker. The denial MUST cover the entire patch and MUST name every offending file. Added-line scanning is authoritative: no content reconstruction is required, and context or removal lines SHALL NOT trigger a denial by themselves.

#### Scenario: Patch adding a suppression line is denied

- **WHEN** a patch adds a `+// eslint-disable-next-line` line to any file
- **THEN** the entire patch operation is denied and the reason names the offending file and marker

#### Scenario: Every offending file is named

- **WHEN** a patch adds suppression markers in two different file sections
- **THEN** the denial reason names both files

#### Scenario: Existing suppressions in untouched context lines do not trigger denial

- **WHEN** a patch modifies other lines in a file whose unchanged context lines contain an existing suppression marker, and no added line contains one
- **THEN** the patch operation is allowed

#### Scenario: Patch without markers is allowed

- **WHEN** a patch adds and updates lines in commentable files without any suppression markers and without touching protected configs
- **THEN** the patch operation is allowed

### Requirement: Unparseable patch payloads fail closed

The system SHALL deny a payload identified as a patch operation when its structure cannot be parsed into file sections, rather than allowing it unexamined.

#### Scenario: Malformed patch envelope is denied

- **WHEN** a patch payload is present but cannot be parsed into file sections
- **THEN** the operation is denied with a reason stating the patch could not be verified
