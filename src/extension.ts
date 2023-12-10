import * as vscode from 'vscode';
import { bin2bin, bin2txt, FileImage } from './a2kit';
import { trailingArgWithSpaces, processDottedPath, hexDump, verifyPath } from './util';
import * as nib from './nibbles';

const providerOptions = {
	transientCellMetadata: {
		runnable: true,
		editable: true,
		custom: true,
	},
	transientDocumentMetadata: {
		runnable: true,
		editable: true,
		custom: true,
	},
	transientOutputs: true
};

const help_string =
"Available commands:\n\
* `help` - this message\n\
* `cd <path>` - change directory\n\
* `dir [<path>]` - display current directory or given path\n\
	- aliases: `catalog`, `ls`\n\
* `tree [--meta]` - display directory tree with optional metadata\n\
* `get <file>` - try to decode file intelligently\n\
* `hex <file>` - display hex dump of file\n\
	- May include headers and extension to block boundary\n\
* `type <file>` - display file as text, decoding blindly\n\
* `clone <file>` - get the detailed file image\n\
* `meta` - get disk image metadata\n\
* `track <track>` - hex dump track nibbles (if applicable)\n\
* `sec <cyl,head,sector>` - hex dump sector\n\
* `block <block>` - hex dump block\n\n\
Notes:\n\
* `dir` supports wildcards with CP/M and FAT disks\n\
* `dir` supports CP/M 3 command tails, e.g., `dir *.com[full]`\n\
* Always use forward slash separator, never backslash\n\
* `<file>` can have spaces, do not quote or escape\n\
* How to handle file type extensions\n\
	- Apple: not part of filename\n\
	- FAT or CP/M: part of filename\n\n\
Scope:\n\
* Handles ProDOS random access text files\n\
* Out of the many CP/M formats, the extension handles:\n\
	- Apple, Amstrad, Kaypro, Nabu, Osborne, TRS-80 M2, and standard 8 inch\n\
* Image types handled are\n\
	- structured: 2MG, IMD, TD0, WOZ\n\
	- raw: D13, DSK, DO, NIB, PO, IMG, IMA\n\
* Notebook cannot be saved, for write access or scripting use `a2kit` directly\n\
* Notebook API does not let us stop you from saving.  If you do, the disk image is simply written back without change.\n";


export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.workspace.registerNotebookSerializer('disk-image-notebook', new DiskImageProvider(), providerOptions));
	let controller = new DiskImageController(); // must come after registering provider
	context.subscriptions.push(controller.vs_controller);
}

class DiskImageProvider implements vscode.NotebookSerializer {
	deserializeNotebook(data: Uint8Array, _token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
		try {
			let vers = bin2txt(['-V'], undefined);
			const matches = vers.match(/a2kit ([0-9]+)\.([0-9]+)\.([0-9]+)/);
			if (!matches || matches?.length!=4) {
				vscode.window.showErrorMessage("error getting a2kit version");
			}
			if (matches?.length == 4) {
				let v = [parseInt(matches[1]), parseInt(matches[2]), parseInt(matches[3])];
				if (v < [2, 6, 0]) {
					vscode.window.showErrorMessage("a2kit 2.6.0 is required, this is " + v[0] + "." + v[1] + "." + v[2]);
				}
			}
		} catch (error) {
			if (error instanceof Error)
				vscode.window.showErrorMessage("error getting a2kit version: " + error.message);
		}
		let out = new vscode.NotebookCellOutput([]);
		try {
			let root_dir = bin2txt(['dir'], Buffer.from(data))
			out.items.push(vscode.NotebookCellOutputItem.text(root_dir));
		} catch (error) {
			if (error instanceof Error)
				out.items.push(vscode.NotebookCellOutputItem.error(error));
		}
		const tip = new vscode.NotebookCellOutput([
			vscode.NotebookCellOutputItem.text("Tip: create a code cell, type `help`, hit `shift-enter`")
		]);
		const cell: vscode.NotebookCellData = {
			kind: vscode.NotebookCellKind.Code,
			value: "dir",
			languageId: "plaintext",
			metadata: {},
			outputs: [out,tip]
		};
		let notebook = new vscode.NotebookData([cell]);
		notebook.metadata = { img_data: Buffer.from(data).toString("hex") };
		return notebook;
	}

	serializeNotebook(data: vscode.NotebookData, _token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
		if (!data.metadata)
			vscode.window.showErrorMessage("The disk image buffer is missing, please backup the file immediately, do NOT save notebook.");
		let buf = data.metadata ? Buffer.from(data.metadata.img_data, "hex") : Buffer.from([0]);
		return new Uint8Array(buf);
	}
}

class DiskImageController {
	vs_controller: vscode.NotebookController;
	path_map = new Map<vscode.NotebookDocument, string>();
	tree_map = new Map<vscode.NotebookDocument, any>();
	constructor() {
		this.vs_controller = vscode.notebooks.createNotebookController('disk-image-id', 'disk-image-notebook', 'Disk Image', this.execute.bind(this));
	}
	private execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) {
		let img_buf = Buffer.from(notebook.metadata.img_data,"hex");
		for (let cell of cells) {
			const execution = controller.createNotebookCellExecution(cell);

			execution.start(Date.now()); // Keep track of elapsed time to execute cell.

			let lines = cell.document.getText().split(/\r?\n/);
			let img_path = this.path_map.get(notebook);
			let out_cells = [];

			for (const line of lines) {
				let cmd = line.split(" ");
				if (cmd.length == 0) {
					continue;
				}
				try {
					if (cmd.length == 1 && cmd[0] == "help") {
						out_cells.push(vscode.NotebookCellOutputItem.text(help_string, "text/markdown"));
					} else if (cmd.length < 4 && (cmd[0] == "dir" || cmd[0] == "ls" || cmd[0] == "catalog")) {
						let args = [cmd[0]];
						if (img_path || cmd.length > 1) {
							args.push("-f");
							args.push(img_path ? img_path : "");
						}
						if (cmd.length > 1) {
							args[args.length - 1] += cmd[1];
						}
						if (cmd.length > 2) {
							if (cmd[2] == "/w")
								args[args.length - 1] += " " + cmd[2];
							else {
								out_cells.push(vscode.NotebookCellOutputItem.text("invalid option"));
								continue;
							}
						}
						const res = bin2txt(args, img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res));
					} else if (cmd.length == 1 && cmd[0] == "tree" || cmd.length == 2 && cmd[0] == "tree" && cmd[1] == "--meta") {
						const res = bin2txt(cmd, img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length == 2 && cmd[0] == "cd") {
						if (!this.tree_map.has(notebook)) {
							const res = bin2txt(["tree"], img_buf);
							this.tree_map.set(notebook, JSON.parse(res));
						}
						const tree = this.tree_map.get(notebook);
						if (!tree) {
							out_cells.push(vscode.NotebookCellOutputItem.text("tree is missing"));
							continue;
						}
						if (tree.file_system != "prodos" && tree.file_system != "fat") {
							out_cells.push(vscode.NotebookCellOutputItem.text("file system has no directories"));
							continue;
						}
						let new_path: string;
						if (cmd[1].charAt(0) == "/") {
							new_path = cmd[1]
						} else {
							new_path = img_path ? img_path : (
								tree.file_system == "prodos" ? "/" + tree.label.name + "/" : "/"
							);
							new_path += cmd[1];
						}
						if (tree.file_system == "prodos" && cmd[1].trim() == "/") {
							new_path = "/" + tree.label.name + "/";
						}
						if (new_path.charAt(cmd[1].length - 1) != "/")
							new_path += "/";
						new_path = processDottedPath(new_path, tree.file_system, tree.label.name);
						if (verifyPath(new_path, tree, tree.file_system, /^.*\/$/)) {
							img_path = new_path;
							this.path_map.set(notebook, new_path);
							out_cells.push(vscode.NotebookCellOutputItem.text("path is set to " + new_path + "\n"));
						} else {
							out_cells.push(vscode.NotebookCellOutputItem.text("invalid path " + new_path + "\n"))
						}
					} else if (cmd.length > 1 && cmd[0] == "get") {
						let path_arg = trailingArgWithSpaces(line, 1);
						let file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt([cmd[0], "-f", file_path, "-t", "any"], img_buf);
						let fimg = new FileImage(res);
						const res2 = fimg.getText(file_path, img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res2));
					} else if (cmd.length > 1 && cmd[0] == "clone") {
						let path_arg = trailingArgWithSpaces(line, 1);
						let file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt(["get", "-f", file_path, "-t", "any"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length > 1 && cmd[0] == "type") {
						let path_arg = trailingArgWithSpaces(line, 1);
						let file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt(["get", "-f", file_path, "-t", "txt"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res));
					} else if (cmd.length > 1 && cmd[0] == "hex") {
						let path_arg = trailingArgWithSpaces(line, 1);
						let file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt(["get", "-f", file_path, "-t", "any"], img_buf);
						let fimg = new FileImage(res);
						const res2 = fimg.getHex(file_path, img_buf, true);
						out_cells.push(vscode.NotebookCellOutputItem.text(res2));
					} else if (cmd.length == 1 && cmd[0] == "meta") {
						const res = bin2txt(["get", "-t", "meta"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length == 2 && cmd[0] == "track") {
						let warn: string | null = null;
						const raw_meta = bin2txt(["get", "-t", "meta"], img_buf);
						const meta = JSON.parse(raw_meta);
						let nibDesc: nib.NibbleDesc | undefined;
						if (meta.nib) {
							warn = "mnemonics assume 16 sector format (nib)";
							nibDesc = nib.Std16;
						} else if (meta["2mg"]?.header?.img_fmt?._raw == "02000000") {
							warn = "mnemonics assume 16 sector format (2mg)";
							nibDesc = nib.Std16;
						} else if (meta.woz1) {
							warn = "mnemonics assume 16 sector format (woz1)";
							nibDesc = nib.Std16;
						} else if (meta.woz2?.info?.disk_type?._raw == "01") {
							if (meta.woz2?.info?.boot_sector_format?._raw == "01")
								nibDesc = nib.Std16;
							else
								nibDesc = nib.Std13;
						} else if (meta.woz2?.info?.disk_type?._raw == "02") {
							nibDesc = nib.Std35;
						}
						if (!nibDesc) {
							out_cells.push(vscode.NotebookCellOutputItem.text("Nibbles not supported for this image"));
							continue;
						}
						const res = bin2bin(["get", "-t", "track", "-f", cmd[1]], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(nib.trackDump(res, nibDesc)));
						if (warn) out_cells.push(vscode.NotebookCellOutputItem.text("WARN: " + warn));
					} else if (cmd.length == 2 && cmd[0] == "sec") {
						const res = bin2bin(["get", "-t", "sec", "-f", cmd[1]], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(hexDump(res, 0)));
					} else if (cmd.length == 2 && cmd[0] == "block") {
						const res = bin2bin(["get", "-t", "block", "-f", cmd[1]], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(hexDump(res, 0)));
					} else {
						out_cells.push(vscode.NotebookCellOutputItem.text("SYNTAX ERROR: " + line));
					}
				} catch (error) {
					if (error instanceof Error)
						out_cells.push(vscode.NotebookCellOutputItem.text(error.message));
				}
			}

			let out_list = []
			for (const cell of out_cells) {
				out_list.push(new vscode.NotebookCellOutput([cell]));
			}
			execution.replaceOutput(out_list);
			execution.end(true, Date.now());
		}
	}
}