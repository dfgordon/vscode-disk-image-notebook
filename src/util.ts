export function processDottedPath(full_path: string,fs: string,lab: string): string {
	let old_nodes = full_path.split("/");
	let new_nodes: string[] = [];
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
	if (last_idx == 0) {
		return line;
	}
	const re = new RegExp('\\S+(\\s+\\S+){'+(last_idx-1)+'}(\\s.+)');
	const matches = line.match(re);
	if (matches) {
		return matches[2].trimStart();
	}
	return line;
}

export function verifyPath(path: string, tree: any, fs: string, req_re: RegExp | null): boolean {
    let nodes = path.split('/');
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
        if (tree.label.name.toLowerCase() != nodes[1].toLowerCase()) {
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
    return tree_node;
}

export function hexDump(dat: Buffer,baseAddr: number) : string {
    const pos_str = Buffer.from(Uint8Array.from(dat).map((val, idx, ary) => {
        return val >= 32 && val < 127 ? val : 46;
    })).toString();
    const neg_str = Buffer.from(Uint8Array.from(dat).map((val, idx, ary) => {
        return val >= 160 && val < 255 ? val - 128 : 46;
    })).toString();
    let content = "";
    const cols = 16;
    for (let i = 0; i < dat.length; i++) {
        if (i % cols == 0 && i > 0) {
            content += '   ' + pos_str.substring(i - cols, i);
            content += '    ' + neg_str.substring(i - cols, i) + '\n';
        }
        if (i % cols == 0)
            content += (baseAddr + i).toString(16).padStart(4, '0').toUpperCase() + ': ';
        content += dat[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
        if (i == dat.length - 1) {
            content += ' '.repeat(3 + 3 * (cols - 1 - i % cols)) + pos_str.substring(i - i % cols, i + 1);
            content += ' '.repeat(4 + cols - 1 - i % cols) + neg_str.substring(i - i % cols, i + 1) + '\n';
        }
    }
    return content;
}
