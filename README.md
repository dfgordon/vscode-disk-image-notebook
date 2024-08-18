# Disk Image Notebook

Click on a disk image in your project tree to see the root directory in the file system's native style.  Dig deeper using either the interactive mode or by entering commands in code cells.  For the present, this is designed to never modify any disk image.

The backend is now bundled for common platforms, no separate installation required.  If your platform is not supported directly see below.

## Demo

<img src="dimg.gif" alt="session capture"/>

note: install appropriate language extensions to gain highlights, diagnostics, etc., upon opening a file in the editor.  Often the file must be saved before analysis becomes available.

## Platform Support

The backend is bundled for Windows x86_64, Linux x86_64, Mac x86_64, and Mac aarch64.  If you have something else the extension will try to fallback to the user's cargo installation.  To install the backend with cargo do the following:

1. Install a C compiler if necessary
2. Install rust if necessary, often a package manager suffices, e.g. `brew install rust`, otherwise search for `rustup`
3. Enter `cargo install a2kit` in your terminal
