# Disk Image Notebook

This targets retro disk images.  Clicking on a supported image will show the directory in the file system's native style.  Various commands are available for extracting files, examining sectors, etc.  For the present, this is designed to never modify any disk image.  Nevertheless, please keep the originals backed up somewhere safe.  *This will do nothing without the backend*.

## Backend Option 1
1. Install a C compiler if necessary
2. Install rust if necessary, often a package manager suffices, e.g. `brew install rust`, otherwise search for `rustup`
3. Enter `cargo install a2kit` in your terminal

## Backend Option 2
[Download an executable](https://github.com/dfgordon/a2kit/releases), taking care to put it in the terminal's path.

## Demo
<img src="dimg.gif" alt="session capture"/>
