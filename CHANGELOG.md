# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.1] - 2025-09-28

### Fixes

* Patch regression that broke interactive mode with logical volumes

## [5.0.0] - 2025-09-27

### New Features

* Handling of quarter tracks
* Handling of proprietary formats
    - JSON can be provided to unlock certain classes of disks
* Sector browser distinguishes address formats
* View nibbles with varying degrees of emulation

### Breaking Changes

* Hex dump format is different
* Geometry output has changed
* `Uint8Array`, `Buffer`, and `string` are interchanged in places
* Some public functions were eliminated
* Requires a2kit 4.x

## [4.0.1] - 2025-01-09

### Fixes

* Update backend to a2kit 3.5.1
    - fixes error in label substitution during disassembly

(universal version will skip this patch)

## [4.0.0] - 2024-12-29

### Fixes

* Eliminate unreasonable consumption of processor cycles
    - but we still have unexplained hesitations on arm64

### New Features

* Better track, sector, and block views
* More robust against simple copy protections

### Breaking Changes

* More internal refactoring
* Track mnemonics are further tweaked

## [3.0.0] - 2024-12-15

### New Features

* Disassembly of sectors and blocks
* Handles Teledisk 1.x in addition to 2.x

### Breaking Changes

* Some internal refactoring
* Track mnemonics are slightly changed

## [2.0.1] - 2024-08-24

### Fixes

* Maintenance update of dependencies
* Disassembler will interpret out of bounds branches as data rather than erroring out

## [2.0.0] - 2024-08-18

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
