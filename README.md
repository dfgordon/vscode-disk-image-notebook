# Disk Image Notebook

Click on a disk image in your project tree to see the root directory in the file system's native style.  Dig deeper using either the interactive mode or by entering commands in code cells.  For the present, this is designed to never modify any disk image.  *This will do nothing without the backend*.

## Backend Option 1
1. Install a C compiler if necessary
2. Install rust if necessary, often a package manager suffices, e.g. `brew install rust`, otherwise search for `rustup`
3. Enter `cargo install a2kit` in your terminal

## Backend Option 2

[Download an executable](https://github.com/dfgordon/a2kit/releases), taking care to put it in the terminal's path.

## Demo

<img src="dimg.gif" alt="session capture"/>

note: install appropriate language extensions to gain highlights, diagnostics, etc., upon opening a file in the editor.  Often the file must be saved before analysis becomes available.