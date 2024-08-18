# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-08-17

### New Features

* Bundled backend for common platforms
* Disassembler for 6502, 65c02, and 65816
* Search for files with a glob pattern
* Indentation control

### Fixes

* Better ProDOS Y2K handling
* Opening Pascal in the editor sets the language
* Amber days is a little more amber

### New Behaviors

Most of the JSON outputs will now default to a minified format.  Recover pretty formatting using the `--indent` option.

### Breaking Changes

* Requires a2kit v3
* Internally, `extension.a2kit.getText` return type has changed
* Internally, `messages.explore.ReturnedFile` constructor has changed
* Internally, `render.explore` generates a new message `OpenDasm`