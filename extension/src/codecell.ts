import * as vscode from 'vscode';
import { bin2bin, bin2txt, FileImage } from './a2kit.js';
import { Geometry } from '../../messages/src/base.js';
import * as util from './util.js';
import * as nib from './nibbles.js';
import { type DiskImageController } from './extension.js';

const help_string =
"Interactive:\n\
* Run the first cell to start interactive\n\
\nCode Cells - navigate: \n\
* `dir [<path>]` - display current directory or given path\n\
	- aliases: `catalog`, `ls`\n\
* `cd <path>` - change directory\n\
* `tree [--meta] [--indent <spaces>]` - display directory tree with optional metadata\n\
\nCode Cells - files: \n\
* `get <file>` - try to decode file intelligently\n\
* `glob <pattern>` - search for files using a glob pattern\n\
* `dasm <processor> <file>` - disassemble file targeting processor\n\
* `hex <file>` - display hex dump of file\n\
	- May include headers and extension to block boundary\n\
* `type <file>` - display file as lossy UTF8\n\
* `clone <file>` - get the detailed file image\n\
\nCode Cells - metadata: \n\
* `meta` - get disk image metadata\n\
* `stat [<indent>]` - get file system statistics\n\
* `geometry [<indent>]` - get disk geometry\n\
\nCode Cells - binary: \n\
* `track <cyl,head>` - hex dump track nibbles (if applicable)\n\
* `sec <cyl,head,sector>` - hex dump sector\n\
* `sec <cyl,head,n1,n2,n3,...,nn>` - hex dump sector sequence\n\
* `block <block>` - hex dump block\n\
\nNotes:\n\
* `dir` supports wildcards with CP/M and FAT disks\n\
* `dir` supports CP/M 3 command tails, e.g., `dir *.com[full]`\n\
* Always use forward slash separator, never backslash\n\
* `<file>` can have spaces, do not quote or escape\n\
* Sequential `sec` request will respect angle-order\n\
* How to handle file type extensions\n\
	- Apple: not part of filename\n\
	- FAT or CP/M: part of filename\n\
\nScope:\n\
* Decodes Applesoft, Integer BASIC, Merlin sources, Pascal sources, ProDOS random access, and others\n\
* Out of the many CP/M formats, the extension handles:\n\
	- Apple, Amstrad, Kaypro, Nabu, Osborne, TRS-80 M2, and IBM 250K (latter encompasses various vendors)\n\
* Image types handled are\n\
	- structured: 2MG, IMD, TD0, WOZ\n\
	- raw: D13, DSK, DO, NIB, PO, IMG, IMA\n\
* Notebook cannot be saved, for write access or scripting use `a2kit` directly\n\
* Notebook API does not let us stop you from saving.  If you do, the disk image is simply written back without change.\n";

export function parse_line(this: DiskImageController, line: string, img_path: string | undefined, img_buf: Buffer, notebook: vscode.NotebookDocument): Array<vscode.NotebookCellOutputItem> {
    const out_cells = new Array<vscode.NotebookCellOutputItem>();
    const cmd = line.split(/\s+/);
    if (cmd.length == 0) {
        return out_cells;
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
                    return out_cells;
                }
            }
            const res = bin2txt(args, img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(res));
        } else if (cmd.length > 0 && cmd.length < 5 && cmd[0] == "tree") {
            const res = bin2txt(cmd, img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
        } else if (cmd.length == 2 && cmd[0] == "cd") {
            const tree = this.updateTree(notebook.metadata.img_hash, img_buf);
            if (!tree) {
                out_cells.push(vscode.NotebookCellOutputItem.text("tree is missing"));
                return out_cells;
            }
            if (tree.file_system != "prodos" && tree.file_system != "fat") {
                out_cells.push(vscode.NotebookCellOutputItem.text("file system has no directories"));
                return out_cells;
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
            const content = fimg.getText(file_path, img_buf)[1];
            out_cells.push(vscode.NotebookCellOutputItem.text(content));
        } else if (cmd.length == 2 && cmd[0] == "glob") {
            const content = bin2txt([cmd[0], "-f", cmd[1], "--indent", "4"], img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(content, "text/x-json"));
        } else if (cmd.length == 3 && cmd[0] == "dasm") {
            const valid_procs = ["6502", "65c02", "65816-00", "65816-01", "65816-10", "65816-11"];
            const proc_arg = cmd[1];
            if (valid_procs.includes(proc_arg)) {
                const path_arg = util.trailingArgWithSpaces(line, 2);
                const proc_parts = proc_arg.split("-");
                const proc = proc_parts[0];
                const mx = proc_parts.length > 1 ? proc_parts[1] : "00";
                const file_path = img_path ? img_path + path_arg : "" + path_arg;
                const fimg_str = bin2txt(["get", "-f", file_path, "-t", "any"], img_buf);
                const fimg = new FileImage(fimg_str);
                const objCode = fimg.getObjectCode(file_path, img_buf);
                let load_addr = objCode.load_addr;
                if (load_addr == 0) {
                    load_addr = 8192; // probably a system file
                }
                const content = bin2txt(["dasm", "-p", proc, "--mx", mx, "--org", load_addr.toString()], Buffer.from(objCode.code));
                out_cells.push(vscode.NotebookCellOutputItem.text(content));
            } else {
                out_cells.push(vscode.NotebookCellOutputItem.text("processor must be one of " + valid_procs + "\n"));
            }
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
        } else if (cmd.length == 2 && cmd[0] == "stat") {
            const indent = parseInt(cmd[1]);
            if (!isNaN(indent)) {
                const res = bin2txt(["stat", "--indent", indent.toString()], img_buf);
                out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
            } else {
                out_cells.push(vscode.NotebookCellOutputItem.text("argument did not parse as integer"));
            }
        } else if (cmd.length == 1 && cmd[0] == "stat") {
            const res = bin2txt(["stat"], img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
        } else if (cmd.length == 2 && cmd[0] == "geometry") {
            const indent = parseInt(cmd[1]);
            if (!isNaN(indent)) {
                const res = bin2txt(["geometry", "--indent", indent.toString()], img_buf);
                out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
            } else {
                out_cells.push(vscode.NotebookCellOutputItem.text("argument did not parse as integer"));
            }
        } else if (cmd.length == 1 && cmd[0] == "geometry") {
            const res = bin2txt(["geometry"], img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(res, "text/x-json"));
        } else if (cmd.length == 2 && cmd[0] == "track") {
            let geo: Geometry | null;
            try {
                geo = this.updateGeometry(notebook.metadata.img_hash, img_buf);
            } catch (error) {
                geo = null;
            }
            if (geo == null) {
                const res = bin2bin(["get", "-t", "track", "-f", cmd[1]], img_buf);
                out_cells.push(vscode.NotebookCellOutputItem.text(nib.trackDump(res, nib.Std16)));
                return out_cells;
            }
            const ch = cmd[1].split(',');
            if (ch.length != 2) {
                out_cells.push(vscode.NotebookCellOutputItem.text("SYNTAX ERROR: " + line));
                return out_cells;
            }
            if (!geo.tracks) {
                out_cells.push(vscode.NotebookCellOutputItem.text("Nibbles not supported for this image"));
                return out_cells;
            }
            const trk = this.findTrack(geo, parseInt(ch[0]), parseInt(ch[1]));
            if (!trk || !trk.nibble_code) {
                out_cells.push(vscode.NotebookCellOutputItem.text("Track not found"));
                return out_cells;
            }
            const res = bin2bin(["get", "-t", "track", "-f", cmd[1]], img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(nib.trackDump(res, this.getNibDesc(geo, trk))));
        } else if (cmd.length == 2 && cmd[0] == "sec") {
            let seq = "";
            if (cmd[1].split(",").length == 3) {
                seq = cmd[1];
            } else {
                const addr_list = cmd[1].split(",");
                for (let sec of addr_list.slice(2)) {
                    seq += addr_list[0] + "," + addr_list[1] + "," + sec + ",,";
                }
                seq = seq.slice(0, -2);
            }
            const res = bin2bin(["get", "-t", "sec", "-f", seq], img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(util.hexDump(res, 0)));
        } else if (cmd.length == 2 && cmd[0] == "block") {
            const res = bin2bin(["get", "-t", "block", "-f", cmd[1]], img_buf);
            out_cells.push(vscode.NotebookCellOutputItem.text(util.hexDump(res, 0)));
        } else if (cmd.length == 1 && cmd[0] == "interactive") {
            out_cells.push(...this.create_interactive(notebook, img_buf));
        } else {
            out_cells.push(vscode.NotebookCellOutputItem.text("SYNTAX ERROR: " + line));
        }
    } catch (error) {
        if (error instanceof Error)
            out_cells.push(vscode.NotebookCellOutputItem.text(error.message));
    }
    return out_cells
}
