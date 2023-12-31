import * as vscode from 'vscode';
import { bin2bin, bin2txt, FileImage } from './a2kit.js';
import * as util from './util.js';
import * as nib from './nibbles.js';
import * as theme from '../../messages/src/themes.js';
import * as interactive from '../../messages/src/base.js';
import * as trk_mess from '../../messages/src/trk.js';
import * as xp_mess from '../../messages/src/explore.js';
import * as crypto from 'crypto';

const GARBAGE_THRESHOLD = 64 * 1024 * 1024;

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
"Interactive:\n\
* Run the first cell to start interactive\n\
\nCode Cells - navigate: \n\
* `dir [<path>]` - display current directory or given path\n\
	- aliases: `catalog`, `ls`\n\
* `cd <path>` - change directory\n\
* `tree [--meta]` - display directory tree with optional metadata\n\
\nCode Cells - files: \n\
* `get <file>` - try to decode file intelligently\n\
* `hex <file>` - display hex dump of file\n\
	- May include headers and extension to block boundary\n\
* `type <file>` - display file as lossy UTF8\n\
* `clone <file>` - get the detailed file image\n\
\nCode Cells - metadata: \n\
* `meta` - get disk image metadata\n\
* `stat` - get file system statistics\n\
* `geometry` - get disk geometry\n\
\nCode Cells - binary: \n\
* `track <cyl,head>` - hex dump track nibbles (if applicable)\n\
* `sec <cyl,head,sector>` - hex dump sector\n\
* `block <block>` - hex dump block\n\
\nNotes:\n\
* `dir` supports wildcards with CP/M and FAT disks\n\
* `dir` supports CP/M 3 command tails, e.g., `dir *.com[full]`\n\
* Always use forward slash separator, never backslash\n\
* `<file>` can have spaces, do not quote or escape\n\
* How to handle file type extensions\n\
	- Apple: not part of filename\n\
	- FAT or CP/M: part of filename\n\
\nScope:\n\
* Decodes Apple tokenized BASIC, Merlin sources, Pascal sources, and others\n\
* Out of the many CP/M formats, the extension handles:\n\
	- Apple, Amstrad, Kaypro, Nabu, Osborne, TRS-80 M2, and standard 8 inch\n\
* Image types handled are\n\
	- structured: 2MG, IMD, TD0, WOZ\n\
	- raw: D13, DSK, DO, NIB, PO, IMG, IMA\n\
* Notebook cannot be saved, for write access or scripting use `a2kit` directly\n\
* Notebook API does not let us stop you from saving.  If you do, the disk image is simply written back without change.\n";


export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.workspace.registerNotebookSerializer('disk-image-notebook', new DiskImageProvider(), providerOptions));
	const controller = new DiskImageController(); // must come after registering provider
	context.subscriptions.push(controller.vs_controller);
}

class DiskImageProvider implements vscode.NotebookSerializer {
	deserializeNotebook(data: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
		const out = new vscode.NotebookCellOutput([]);
		const img_hash = crypto.createHash('sha256').update(data).digest('hex');
		try {
			const vers = bin2txt(['-V'], undefined);
			const matches = vers.match(/a2kit ([0-9]+)\.([0-9]+)\.([0-9]+)/);
			if (!matches || matches?.length!=4) {
				vscode.window.showErrorMessage("error getting a2kit version");
			}
			if (matches?.length == 4) {
				const v = [parseInt(matches[1]), parseInt(matches[2]), parseInt(matches[3])];
				if (v >= [3, 0, 0]) {
					const mess = "a2kit 2.x is expected, found " + v[0] + "." + v[1] + "." + v[2];
					vscode.window.showErrorMessage(mess);
					out.items.push(vscode.NotebookCellOutputItem.text("ERROR: " + mess));
				}
				if (v < [2, 7, 0]) {
					const mess = "a2kit 2.7.0 is required, found " + v[0] + "." + v[1] + "." + v[2];
					vscode.window.showErrorMessage(mess);
					out.items.push(vscode.NotebookCellOutputItem.text("ERROR: " + mess));
				}
			}
		} catch (error) {
			if (error instanceof Error)
				vscode.window.showErrorMessage("error getting a2kit version: " + error.message);
		}
		try {
			const root_dir = bin2txt(['dir'], Buffer.from(data));
			out.items.push(vscode.NotebookCellOutputItem.text(root_dir));
		} catch (error) {
			out.items.push(vscode.NotebookCellOutputItem.text("could not solve file system, but track solutions may exist"));
		}
		const tip = new vscode.NotebookCellOutput([
			vscode.NotebookCellOutputItem.text("Tip: create a code cell, type `help`, hit `shift-enter`")
		]);
		const cell: vscode.NotebookCellData = {
			kind: vscode.NotebookCellKind.Code,
			value: "interactive",
			languageId: "plaintext",
			metadata: {},
			outputs: [out,tip]
		};
		const notebook = new vscode.NotebookData([cell]);
		notebook.metadata = { img_data: Buffer.from(data).toString("hex"), img_hash };
		return notebook;
	}

	serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
		if (!data.metadata)
			vscode.window.showErrorMessage("The disk image buffer is missing, please backup the file immediately, do NOT save notebook.");
		const buf = data.metadata ? Buffer.from(data.metadata.img_data, "hex") : Buffer.from([0]);
		return new Uint8Array(buf);
	}
}

class DiskImageController {
	vs_controller: vscode.NotebookController;
	vs_messager: vscode.NotebookRendererMessaging;
	path_map = new Map<string, string>();
	tree_map = new Map<string, util.Tree>();
	data_map = new Map<string, Buffer>();
	geometry_map = new Map<string, interactive.Geometry>();
	stat_map = new Map<string, interactive.Stat>();
	stale_map = new Map<string, number>();
	constructor() {
		//console.log("construct disk image controller");
		this.vs_controller = vscode.notebooks.createNotebookController('disk-image-id', 'disk-image-notebook', 'Disk Image', this.execute.bind(this));
		this.vs_messager = vscode.notebooks.createRendererMessaging('disk-image-interactive');
		this.vs_controller.onDidChangeSelectedNotebooks((event: {readonly notebook: vscode.NotebookDocument,readonly selected:boolean}) => {
			const now = Date.now();
			const hash = event.notebook.metadata.img_hash;
			const buf = this.updateData(hash, event.notebook.metadata.img_data);
			this.updateGeometry(hash, buf);
			this.updateStatistics(hash, buf);
			this.updateTree(hash, buf);
			this.stale_map.set(hash, now);
			this.garbageCollection(hash, now);
		});
		this.vs_messager.onDidReceiveMessage(event => {
			if (!event.message.img_hash) {
				console.log("message not handled by controller (no hash)")
				return;
			}
			const img_buf = this.data_map.get(event.message.img_hash);
			if (!img_buf) {
				vscode.window.showErrorMessage("no buffer, if it was deleted to save resources, re-running the code cell might restore it")
				console.log("message not handled by controller (no buffer)")
				return;
			}
			if (trk_mess.LoadSector.test(event.message)) {
				const messg: trk_mess.LoadSector = event.message;
				//console.log("loading sector " + messg.chs);
				const chs_str = messg.chs[0].toString() + "," + messg.chs[1].toString() + "," + messg.chs[2].toString();				
				try {
					const res = bin2bin(["get", "-t", "sec", "-f", chs_str], img_buf);
					this.vs_messager.postMessage(new trk_mess.ReturnedSector(util.hexDump(res, 0),messg.img_hash));
				} catch (error: any) {
					this.vs_messager.postMessage(new trk_mess.ReturnedSector(error.message,messg.img_hash));
				}
			} else if (trk_mess.LoadBlock.test(event.message)) {
				const messg: trk_mess.LoadBlock = event.message;
				//console.log("loading block " + messg.block);
				try {
					const res = bin2bin(["get", "-t", "block", "-f", messg.block.toString()],img_buf);
					this.vs_messager.postMessage(new trk_mess.ReturnedBlock(util.hexDump(res, 0),messg.img_hash));
				} catch (error: any) {
					this.vs_messager.postMessage(new trk_mess.ReturnedBlock(error.message,messg.img_hash));
				}
			} else if (trk_mess.LoadNibbles.test(event.message)) {
				const messg: trk_mess.LoadNibbles = event.message;
				//console.log("loading nibbles " + messg.ch);
				const ch_str = messg.ch[0].toString() + "," + messg.ch[1].toString();
				try {
					const res = bin2bin(["get", "-t", "track", "-f", ch_str], img_buf);
					const nib_desc = nib.GetNibbleDesc(img_buf);
					if (nib_desc)
						this.vs_messager.postMessage(new trk_mess.ReturnedNibbles(nib.trackDump(res, nib_desc),messg.img_hash));
				} catch (error: any) {
					this.vs_messager.postMessage(new trk_mess.ReturnedNibbles(error.message,messg.img_hash));
				}
			} else if (xp_mess.ChangeDirectory.test(event.message)) {
				const messg: xp_mess.ChangeDirectory = event.message;
				const tree = this.updateTree(messg.img_hash, img_buf);
				const new_path = util.processDottedPath(messg.curr_path + messg.subdir + "/",tree.file_system,tree.label.name);
				const [new_path_actual, rows] = util.getFiles(new_path, tree);
				if (rows) {
					this.vs_messager.postMessage(new xp_mess.ReturnedSubdirectory(new_path_actual, rows, messg.img_hash));
				}
				else {
					const cpm_corrected = tree.file_system == "cpm" ? new_path_actual.replace(/\/([0-9]+)\/(.*)/, '$1:$2') : new_path_actual;
					const res = bin2txt(["get", "-f", cpm_corrected, "-t", "any"], img_buf);
					const fimg = new FileImage(res);
					const res2 = fimg.getText(cpm_corrected, img_buf);
					this.vs_messager.postMessage(new xp_mess.ReturnedFile(new_path_actual, res2, fimg.img.fs_type, messg.img_hash));
				}
			} else if (xp_mess.OpenFile.test(event.message)) {
				const messg: xp_mess.OpenFile = event.message;
				const typ = parseInt(messg.typ, 16);
				let lang = 'plaintext';
				if (messg.fs == "prodos") {
					if (typ == 0xfa)
						lang = 'integerbasic';
					if (typ == 0xfc)
						lang = 'applesoft';
				} else if (messg.fs == "a2 dos") {
					if ((typ & 0x7f) == 0x01)
						lang = 'integerbasic';
					if ((typ & 0x7f) == 0x02)
						lang = 'applesoft'
				}
				vscode.workspace.openTextDocument({content: messg.content, language: lang}).then(doc => {
					vscode.window.showTextDocument(doc);
				});
			}
		});
	}
	/** There seems to be no way to figure when a notebook is disposed,
	 * so we listen for notebook selection event and then throw out the stalest references
	 * when a storage threshold is exceeded.  Code cells will be able to reacquire the
	 * the references later, but the interactive renderer cannot. The renderer is notified
	 * that it's references were deleted so it can display a message.
	 */
	garbageCollection(curr_hash: string, now: number) {
		// work out currently used storage, assuming the buffer dominates
		let curr_storage = 0;
		for (const buf of this.data_map.values()) {
			curr_storage += buf.length;
		}
		console.log("garbage collector: current storage " + curr_storage);
		// If threshold exceeded collect garbage.
		while (curr_storage > GARBAGE_THRESHOLD) {
			let oldest = now;
			let oldest_hash: string | null = null;
			// find the notebook with the most stale references 
			for (const [key, val] of this.stale_map) {
				if (val < oldest) {
					oldest = val;
					oldest_hash = key;
				}
			}
			// If we found one throw it's references away
			if (oldest_hash && oldest != now) {
				console.log("garbage collector: disposing of " + oldest_hash);
				this.vs_messager.postMessage(new interactive.ReferencesWereDeleted(oldest_hash));
				this.data_map.delete(oldest_hash);
				this.stat_map.delete(oldest_hash);
				this.geometry_map.delete(oldest_hash);
				this.tree_map.delete(oldest_hash);
				this.stale_map.delete(oldest_hash);
			} else {
				// nothing left to dispose, exit
				break;
			}
		}
	}
	/** get and return the secondary buffer, retrieving from the main hex string that
	 * is stored in the notebook's metadata, if not already done
	 * @throws Error
	 */
	updateData(img_hash: string, img_data: string): Buffer {
		let buf = this.data_map.get(img_hash);
		if (buf)
			return buf;
		buf = Buffer.from(img_data, "hex");
		this.data_map.set(img_hash, buf);
		return buf;
	}
	/** get and return the tree, retrieving from disk if not already done
	 * @throws Error
	 */
	updateTree(img_hash: string, img_buf: Buffer): util.Tree {
		let tree = this.tree_map.get(img_hash);
		if (tree)
			return tree;
		const json_str = bin2txt(["tree", "--meta"], img_buf);
		tree = JSON.parse(json_str);
		if (tree) {
			this.tree_map.set(img_hash, tree);
			return tree;
		}
		throw Error;
	}
	/** get and return the stats, retrieving from disk if not already done
	 * @throws Error
	 */
	updateStatistics(img_hash: string, img_buf: Buffer): interactive.Stat {
		let stat = this.stat_map.get(img_hash);
		if (stat)
			return stat;
		const json_str = bin2txt(["stat"], img_buf);
		stat = JSON.parse(json_str);
		if (stat) {
			this.stat_map.set(img_hash, stat);
			return stat;				
		}
		throw Error;
	}
	/** get and return the geometry, retrieving from disk if not already done
	 * @throws Error
	 */
	updateGeometry(img_hash: string, img_buf: Buffer): interactive.Geometry {
		let geo = this.geometry_map.get(img_hash);
		if (geo)
			return geo;
		const json_str = bin2txt(["geometry"], img_buf);
		geo = JSON.parse(json_str);
		if (geo) {
			this.geometry_map.set(img_hash, geo);
			return geo;				
		}
		throw Error;
	}
	findTrack(geo: interactive.Geometry,cyl: number, head: number) : interactive.Track | null {
		for (const trk of geo.tracks) {
			if (!trk)
				return null;
			if (trk.cylinder == cyl && trk.head == head) {
				return trk
			}
		}
		return null;
	}
	getNibDesc(geo: interactive.Geometry,trk: interactive.Track): nib.NibbleDesc {
		if (trk.nibble_code == "5&3")
			return nib.Std13;
		if (trk.nibble_code == "6&2" && geo.package == "5.25")
			return nib.Std16;
		return nib.Std35;
	}
	private execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) {
		const img_buf = this.updateData(notebook.metadata.img_hash, notebook.metadata.img_data);
		for (const cell of cells) {
			const execution = controller.createNotebookCellExecution(cell);

			execution.start(Date.now()); // Keep track of elapsed time to execute cell.

			const lines = cell.document.getText().split(/\r?\n/);
			let img_path = this.path_map.get(notebook.metadata.img_hash);
			const out_cells = [];

			for (const line of lines) {
				const cmd = line.split(" ");
				if (cmd.length == 0) {
					continue;
				}
				try {
					if (cmd.length == 1 && cmd[0] == "help") {
						out_cells.push(vscode.NotebookCellOutputItem.text(help_string, "text/markdown"));
					} else if (cmd.length < 4 && (cmd[0] == "dir" || cmd[0] == "ls" || cmd[0] == "catalog")) {
						const args = [cmd[0]];
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
						const tree = this.updateTree(notebook.metadata.img_hash, img_buf);
						if (!tree) {
							out_cells.push(vscode.NotebookCellOutputItem.text("tree is missing"));
							continue;
						}
						if (tree.file_system != "prodos" && tree.file_system != "fat") {
							out_cells.push(vscode.NotebookCellOutputItem.text("file system has no directories"));
							continue;
						}
						let new_path: string;
						if (cmd[1].trim() == "/") {
							new_path = util.rootPath(tree);
						} else if (cmd[1].charAt(0) == "/") {
							new_path = cmd[1]
						} else {
							new_path = img_path ? img_path : util.rootPath(tree);
							new_path += cmd[1];
						}
						if (new_path.charAt(cmd[1].length - 1) != "/")
							new_path += "/";
						new_path = util.processDottedPath(new_path, tree.file_system, tree.label.name);
						if (util.verifyPath(new_path, tree, tree.file_system, /^.*\/$/)) {
							img_path = new_path;
							this.path_map.set(notebook.metadata.img_hash, new_path);
							out_cells.push(vscode.NotebookCellOutputItem.text("path is set to " + new_path + "\n"));
						} else {
							out_cells.push(vscode.NotebookCellOutputItem.text("invalid path " + new_path + "\n"))
						}
					} else if (cmd.length > 1 && cmd[0] == "get") {
						const path_arg = util.trailingArgWithSpaces(line, 1);
						const file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt([cmd[0], "-f", file_path, "-t", "any"], img_buf);
						const fimg = new FileImage(res);
						const res2 = fimg.getText(file_path, img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res2));
					} else if (cmd.length > 1 && cmd[0] == "clone") {
						const path_arg = util.trailingArgWithSpaces(line, 1);
						const file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt(["get", "-f", file_path, "-t", "any"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length > 1 && cmd[0] == "type") {
						const path_arg = util.trailingArgWithSpaces(line, 1);
						const file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2bin(["get", "-f", file_path, "-t", "bin"], img_buf);
						const lossyText = res.toString("utf8");
						out_cells.push(vscode.NotebookCellOutputItem.text(lossyText));
					} else if (cmd.length > 1 && cmd[0] == "hex") {
						const path_arg = util.trailingArgWithSpaces(line, 1);
						const file_path = img_path ? img_path + path_arg : "" + path_arg;
						const res = bin2txt(["get", "-f", file_path, "-t", "any"], img_buf);
						const fimg = new FileImage(res);
						const res2 = fimg.getHex(file_path, img_buf, true);
						out_cells.push(vscode.NotebookCellOutputItem.text(res2));
					} else if (cmd.length == 1 && cmd[0] == "meta") {
						const res = bin2txt(["get", "-t", "meta"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length == 1 && cmd[0] == "stat") {
						const res = bin2txt(["stat"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length == 1 && cmd[0] == "geometry") {
						const res = bin2txt(["geometry"], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
					} else if (cmd.length == 2 && cmd[0] == "track") {
						const geo = this.updateGeometry(notebook.metadata.img_hash, img_buf);
						const ch = cmd[1].split(',');
						if (ch.length != 2) {
							out_cells.push(vscode.NotebookCellOutputItem.text("SYNTAX ERROR: " + line));
							continue;
						}
						const trk = this.findTrack(geo, parseInt(ch[0]), parseInt(ch[1]));
						if (!trk || !trk.nibble_code) {
							out_cells.push(vscode.NotebookCellOutputItem.text("Nibbles not supported for this image"));
							continue;
						}
						const res = bin2bin(["get", "-t", "track", "-f", cmd[1]], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(nib.trackDump(res, this.getNibDesc(geo,trk))));
					} else if (cmd.length == 2 && cmd[0] == "sec") {
						const res = bin2bin(["get", "-t", "sec", "-f", cmd[1]], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(util.hexDump(res, 0)));
					} else if (cmd.length == 2 && cmd[0] == "block") {
						const res = bin2bin(["get", "-t", "block", "-f", cmd[1]], img_buf);
						out_cells.push(vscode.NotebookCellOutputItem.text(util.hexDump(res, 0)));
					} else if (cmd.length == 1 && cmd[0] == "interactive") {
						let tree: util.Tree | null = null;
						let geometry: interactive.Geometry | null = null;
						let stat: interactive.Stat | null = null;
						let root_path: string | null = null;
						let root_files: interactive.DirectoryRow[] | null = null;
						let start_path: string | null = null;
						let start_files: interactive.DirectoryRow[] | null = null;
						try {
							tree = this.updateTree(notebook.metadata.img_hash, img_buf);
							stat = this.updateStatistics(notebook.metadata.img_hash, img_buf);
							[root_path, root_files] = util.getFiles(util.rootPath(tree), tree);
							// if CP/M has a user 0, we should start off there for convenience
							if (stat.fs_name == "cpm" && stat.users.includes("0")) {
								[start_path, start_files] = util.getFiles("/0/", tree);
							} else {
								[start_path, start_files] = [root_path, root_files];
							}
						} catch (Error) {
							console.log("could not determine disk file system");
						}
						try {
							geometry = this.updateGeometry(notebook.metadata.img_hash, img_buf);
						} catch (Error) {
							console.log("could not determine disk geometry");
						}
						if (stat == null && (geometry == null || geometry.tracks == null)) {
							out_cells.push(vscode.NotebookCellOutputItem.text("Disk could not be solved on any level"));
						} else {
							const config = vscode.workspace.getConfiguration("diskimage");
							const theme_str = config.get('interactiveTheme') as string;
							let color_theme = theme.AmberDays;
							if (theme_str == "Sith Lord") {
								color_theme = theme.SithLord;
							} else if (theme_str == "True Neutral") {
								color_theme = theme.TrueNeutral;
							}
							const create_mess: interactive.CreateInteractive = {
								img_hash: notebook.metadata.img_hash,
								geometry,
								stat,
								root_path,
								root_files,
								start_path,
								start_files,
								color_theme
							};
							out_cells.push(vscode.NotebookCellOutputItem.json(create_mess, 'x-application/disk-image-interactive'));
						}
					} else {
						out_cells.push(vscode.NotebookCellOutputItem.text("SYNTAX ERROR: " + line));
					}
				} catch (error) {
					if (error instanceof Error)
						out_cells.push(vscode.NotebookCellOutputItem.text(error.message));
				}
			}

			const out_list = []
			for (const cell of out_cells) {
				out_list.push(new vscode.NotebookCellOutput([cell]));
			}
			execution.replaceOutput(out_list);
			execution.end(true, Date.now());
		}
	}
}