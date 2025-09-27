import { DirectoryRow } from "../../messages/src/base.js";

export interface Tree {
    file_system: string,
    // eslint-disable-next-line
    files: any,
    label: {
        name: string | undefined
    }
}

export function parseAddr(addr: string): number[] {
    const ans: number[] = [];
    const l = addr.length / 2;
    for (var i = 0; i < l; i++) {
        ans.push(parseInt(addr.substring(2 * i, 2 * i + 2), 16));
    }
    return ans;
}

export function rootPath(tree: Tree): string {
    return tree.file_system == "prodos" ? "/" + tree.label.name + "/" : "/";
}

export function cpmForm(path: string): string {
    let newPath = path.replace(/\/([0-9]+)\/(.*)/, '$1:$2');
    // a2kit 2.7.0 can't find a file without an extension without a trailing `.`
    if (newPath.lastIndexOf('.') == -1)
        newPath += '.';
    return newPath;
}

/**
 * Get directory rows.  If path leads to a file the rows will be null.
 * Empty directroy will not be null, just empty array.
 * @param path path of subdirectory or file
 * @param tree the entire directory tree with metadata
 * @returns [new path, directory rows or null]
 */
export function getFiles(path: string, tree: Tree): [string, DirectoryRow[] | null] {
    const nodes = path.split("/");
    let new_path = "";
    const beg = tree.file_system == "prodos" ? 2 : 1;
    let subdir = tree.files;
    for (let lev = 0; lev < beg; lev++) {
        new_path += nodes[lev] + "/";
    }
    for (let lev = beg; lev < nodes.length; lev++) {
        if (nodes[lev] == "")
            break;
        const temp = subdir[nodes[lev]];
        if (!temp)
            break;
        if (!temp.files) {
            // this is a file
            if (tree.file_system == "a2 dos" || tree.file_system == "a2 pascal") {
                return [nodes[lev], null];
            } else {
                return [new_path + nodes[lev], null];
            }
        }
        new_path += nodes[lev] + "/";
        subdir = temp.files;
    }
    const rows: DirectoryRow[] = [];
    for (const key of Object.keys(subdir)) {
        rows.push({
            name: key,
            meta: subdir[key].meta ? subdir[key].meta : {},
        });
    }
    return [new_path, rows];
}

export function processDottedPath(full_path: string, fs: string, lab: string | undefined): string {
	const old_nodes = full_path.split("/");
	const new_nodes: string[] = [];
	for (const node of old_nodes) {
		if (node == ".") {
			continue;
		} else if (node == "..") {
			new_nodes.pop();
		} else {
			new_nodes.push(node);
		}
	}
	let ans = "/";
	for (const node of new_nodes) {
		if (node.length>0)
			ans += node + "/";
	}
	if (fs == "prodos" && ans == "/") {
		ans = "/" + lab + "/";
	}
	return ans;
}

export function trailingArgWithSpaces(line: string, last_idx: number): string {
    let ans = line;
    if (last_idx > 0) {
        const re = new RegExp('\\S+(\\s+\\S+){' + (last_idx - 1) + '}(\\s.+)');
        const matches = line.match(re);
        if (matches) {
            ans = matches[2].trimStart();
        }
    }
	return ans;
}

export function verifyPath(path: string, tree: Tree, fs: string, req_re: RegExp | null): boolean {
    const nodes = path.split('/');
    if (nodes.length < 2) {
        return false;
    }
    const beg = fs == "prodos" ? 2 : 1;
    const end = nodes[nodes.length - 1] == "" ? nodes.length - 1 : nodes.length;
    if (req_re) {
        if (!path.match(req_re))
            return false;
    }
    if (fs == "prodos") {
        if (tree.label.name?.toLowerCase() != nodes[1].toLowerCase()) {
            return false;
        }
    }
    let tree_node = tree.files;
    for (let n = beg; n < end; n++) {
        if (!tree_node)
            return false;
        // case sensitivity is an issue here: need explicit loop
        let match: string | null = null;
        for (const file in tree_node) {
            if (file.toLowerCase() == nodes[n].toLowerCase())
                match = file;
        }
        if (match)
            tree_node = tree_node[match];
        else
            return false;
        tree_node = tree_node.files;
    }
    return true;
}

export function hexDump(dat: Uint8Array,baseAddr: number) : string {
    const pos_str = Buffer.from(dat.map((val) => {
        return val >= 32 && val < 127 ? val : 46;
    })).toString();
    const neg_str = Buffer.from(dat.map((val) => {
        return val >= 160 && val < 255 ? val - 128 : 46;
    })).toString();
    let content = "";
    const cols = 16;
    for (let i = 0; i < dat.length; i++) {
        if (i % cols == 0 && i > 0) {
            content += '|+| ' + pos_str.substring(i - cols, i);
            content += ' |-| ' + neg_str.substring(i - cols, i) + '\n';
        }
        if (i % cols == 0)
            content += (baseAddr + i).toString(16).padStart(4, '0').toUpperCase() + ' : ';
        content += dat[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
        if (i == dat.length - 1) {
            content += ' '.repeat(3 * (cols - 1 - i % cols)) + '|+| ' + pos_str.substring(i - i % cols, i + 1);
            content += ' '.repeat(cols - 1 - i % cols) + ' |-| ' + neg_str.substring(i - i % cols, i + 1) + '\n';
        }
    }
    return content;
}
