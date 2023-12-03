# vscode-disk-image-notebook

Look inside disk images right from your VS Code project.  Clicking on a supported disk image will show the disk directory in the file system's native style.  Various commands are available for extracting files, examining sectors, etc.  For the present, this is designed to never modify any disk image.  Nevertheless:

*backup your disk images*

If the notebook is saved, the disk image is written back, but with no changes.  The notebook itself, i.e. its cells, cannot be saved, although cell contents can be moved to other documents using the clipboard.  Yes, this is an abuse of the notebook persistence model, but we gain the convenience of selecting a disk image directly from the project tree.

Dependency: [a2kit](https://github.com/dfgordon/a2kit) must be installed and in the path.

https://github.com/dfgordon/vscode-disk-image-notebook/assets/13408285/2bc70773-f32b-4f01-bbd5-d1f245840085


