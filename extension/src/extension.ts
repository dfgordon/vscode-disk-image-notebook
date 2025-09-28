import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from './util.js';
import * as mess_base from '../../messages/src/base.js';
import { bin2txt, bin2bin } from './a2kit.js';
import { handle_request, create_interactive } from './interactive.js';
import { parse_line } from './codecell.js';

export let serverCommand: string | undefined = undefined;
let serverVersionString = "not found";

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

function getExecutableNames(context: vscode.ExtensionContext): string[] {
	const ans = [];
	const targetFolder = os.platform() + "-" + os.arch();
	const exe = os.platform() == "win32" ? "a2kit.exe" : "a2kit";
	ans.push(context.asAbsolutePath(path.join('server', targetFolder, exe)));
	ans.push(path.join(os.homedir(),".cargo","bin",exe));
	return ans;
}

export function activate(context: vscode.ExtensionContext) {
	const serverCommandOptions = getExecutableNames(context);
	for (const cmd of serverCommandOptions) {
		if (fs.existsSync(cmd)) {
			try {
				fs.accessSync(cmd, fs.constants.X_OK);
			} catch (err) {
				fs.chmodSync(cmd, fs.constants.S_IXUSR | fs.constants.S_IRUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH);
			}
			serverCommand = cmd;
			break;
		}
	}
	if (!serverCommand) {
		vscode.window.showErrorMessage("Neither a bundled nor an installed backend could be found for this platform.  You may be able to solve this with `cargo install a2kit`.");
		return;
	}
	context.subscriptions.push(vscode.workspace.registerNotebookSerializer('disk-image-notebook', new DiskImageProvider(), providerOptions));
	const controller = new DiskImageController(); // must come after registering provider
	context.subscriptions.push(controller.vs_controller);
}

class DiskImageProvider implements vscode.NotebookSerializer {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	deserializeNotebook(data: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
		const out = new vscode.NotebookCellOutput([]);
		const img_hash = crypto.createHash('sha256').update(data).digest('hex');
		if (!serverCommand) {
			out.items.push(vscode.NotebookCellOutputItem.text("ERROR: no backend"));
		} else {
			try {
				serverVersionString = bin2txt(['-V'], undefined, undefined, undefined);
				console.log("mounting image with backend version: " + serverVersionString);
				const matches = serverVersionString.match(/a2kit ([0-9]+)\.([0-9]+)\.([0-9]+)/);
				if (!matches || matches?.length != 4) {
					vscode.window.showErrorMessage("error getting a2kit version");
				}
				if (matches?.length == 4) {
					const v = [parseInt(matches[1]), parseInt(matches[2]), parseInt(matches[3])];
					if (v >= [5, 0, 0]) {
						const mess = "a2kit 4.x is expected, found " + v[0] + "." + v[1] + "." + v[2];
						vscode.window.showErrorMessage(mess);
						out.items.push(vscode.NotebookCellOutputItem.text("ERROR: " + mess));
					}
					if (v < [4, 0, 0]) {
						const mess = "a2kit 4.0.0 is required, found " + v[0] + "." + v[1] + "." + v[2];
						vscode.window.showErrorMessage(mess);
						out.items.push(vscode.NotebookCellOutputItem.text("ERROR: " + mess));
					}
				}
			} catch (error) {
				if (error instanceof Error)
					vscode.window.showErrorMessage("error getting a2kit version: " + error.message);
			}
			try {
				const root_dir = bin2txt(['dir'], data, undefined, undefined);
				out.items.push(vscode.NotebookCellOutputItem.text(root_dir));
			} catch (error) {
				out.items.push(vscode.NotebookCellOutputItem.text("could not solve file system, but track solutions may exist"));
			}
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
		if (!data.metadata)
			vscode.window.showErrorMessage("The disk image buffer is missing, please backup the file immediately, do NOT save notebook.");
		const buf = data.metadata ? Buffer.from(data.metadata.img_data, "hex") : Buffer.from([0]);
		return new Uint8Array(buf);
	}
}

export class DiskImageController {
	// imported members from other files
	create_interactive = create_interactive;
	handle_request = handle_request;
	parse_line = parse_line;
	// ordinary members
	vs_controller: vscode.NotebookController;
	vs_messager: vscode.NotebookRendererMessaging;
	path_map = new Map<string, string>();
	tree_map = new Map<string, util.Tree>();
	data_map = new Map<string, Uint8Array>();
	geometry_map = new Map<string, mess_base.Geometry>();
	stat_map = new Map<string, mess_base.Stat>();
	stale_map = new Map<string, number>();
	fmt_map = new Map<string, string>();
	method_map = new Map<string, string>();
	constructor() {
		console.log("using backend " + serverCommand);
		this.vs_controller = vscode.notebooks.createNotebookController('disk-image-id', 'disk-image-notebook', 'Disk Image', this.execute.bind(this));
		this.vs_messager = vscode.notebooks.createRendererMessaging('disk-image-interactive');
		this.vs_controller.onDidChangeSelectedNotebooks((event: {readonly notebook: vscode.NotebookDocument,readonly selected:boolean}) => {
			const now = Date.now();
			const hash = event.notebook.metadata.img_hash;
			const buf = this.updateData(hash, event.notebook.metadata.img_data);
			try {
				this.updateGeometry(hash, buf);
			} catch (error) {
				console.log("could not update geometry");
			}
			try {
				this.updateStatistics(hash, buf);
			} catch (error) {
				console.log("could not update stats");
			}
			try {
				this.updateTree(hash, buf);
			} catch (error) {
				console.log("could not update tree");
			}
			this.stale_map.set(hash, now);
			this.garbageCollection(hash, now);
		});
		this.vs_messager.onDidReceiveMessage(event => {
			this.handle_request(event);
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
				this.vs_messager.postMessage(new mess_base.ReferencesWereDeleted(oldest_hash));
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
	 */
	updateData(img_hash: string, img_data: string): Uint8Array {
		let buf = this.data_map.get(img_hash);
		if (buf)
			return buf;
		buf = Uint8Array.from(Buffer.from(img_data, "hex"));
		this.data_map.set(img_hash, buf);
		return buf;
	}
	/** get and return the tree, retrieving from disk if not already done
	 * @throws Error
	 */
	updateTree(img_hash: string, img_buf: Uint8Array): util.Tree {
		let tree = this.tree_map.get(img_hash);
		let maybe_fmt = this.fmt_map.get(img_hash);
		let maybe_method = this.method_map.get(img_hash);
		if (tree)
			return tree;
		const json_str = bin2txt(["tree", "--meta"], img_buf, maybe_method, maybe_fmt);
		try {
			tree = JSON.parse(json_str);
			if (tree) {
				this.tree_map.set(img_hash, tree);
				return tree;
			}
		} catch (e) {
			throw e;
		}
		throw Error;
	}
	/** get and return the stats, retrieving from disk if not already done
	 * @throws Error
	 */
	updateStatistics(img_hash: string, img_buf: Uint8Array): mess_base.Stat {
		let stat = this.stat_map.get(img_hash);
		if (stat)
			return stat;
		const json_str = bin2txt(["stat"], img_buf, this.method_map.get(img_hash), this.fmt_map.get(img_hash));
		try {
			stat = JSON.parse(json_str);
			if (stat) {
				this.stat_map.set(img_hash, stat);
				return stat;				
			}
		} catch (e) {
			throw e;
		}
		throw Error;
	}
	/** get and return the geometry, retrieving from disk if not already done
	 * @throws Error
	 */
	updateGeometry(img_hash: string, img_buf: Uint8Array): mess_base.Geometry {
		let geo = this.geometry_map.get(img_hash);
		if (geo)
			return geo;
		const json_str = bin2txt(["geometry"], img_buf, this.method_map.get(img_hash), this.fmt_map.get(img_hash));
		try {
			geo = JSON.parse(json_str);
			if (geo) {
				this.geometry_map.set(img_hash, geo);
				return geo;				
			}
		} catch (e) {
			throw e;
		}
		throw Error;
	}
	testNibbles(geo: mess_base.Geometry | null, img_hash: string, img_buf: Uint8Array): boolean {
		if (geo == null) {
			return false;
		}
		let ch = "0,0";
		for (const trk of geo.tracks) {
			if (trk) {
				ch = trk.cylinder.toString() + "," + trk.head.toString();
				break;
			}
		}
		try {
			const res = bin2bin(["get", "-t", "track", "-f", ch], img_buf, this.method_map.get(img_hash), this.fmt_map.get(img_hash));
			return true;
		} catch (err) {
			return false;
		}
	}
	private execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) {
		const img_buf = this.updateData(notebook.metadata.img_hash, notebook.metadata.img_data);
		for (const cell of cells) {
			const execution = controller.createNotebookCellExecution(cell);

			execution.start(Date.now()); // Keep track of elapsed time to execute cell.

			const all_txt = cell.document.getText();
			try {
				const try_json: Object = JSON.parse(all_txt);
				if (try_json && try_json.hasOwnProperty("a2kit_type")) {
					this.fmt_map.set(notebook.metadata.img_hash, all_txt);
					execution.replaceOutput([new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text("JSON successfully parsed")])]);
				} else {
					execution.replaceOutput([new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text("JSON parsed but not understood")])]);
				}
				execution.end(true, Date.now());
			} catch (err) {
				const lines = cell.document.getText().split(/\r?\n/);
				let img_path = this.path_map.get(notebook.metadata.img_hash);
				const out_cells = [];

				for (const line of lines) {
					out_cells.push(...this.parse_line(line, img_path, img_buf, notebook));
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
}