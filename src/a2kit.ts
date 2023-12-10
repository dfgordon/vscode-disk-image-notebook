import { spawnSync } from 'child_process';
import { hexDump } from './util'

const A2DosMap = new Map<string, string>([
	["00", "txt"],
	["01", "itok"],
	["02", "atok"],
	["80", "txt"],
	["81", "itok"],
	["82", "atok"],
]);

const ProDosMap = new Map<string, string>([
	["04", "txt"],
	["fa", "itok"],
	["fc", "atok"],
]);

const PascalMap = new Map<string, string>([
	["0300", "txt"],
]);

const CpmMap = new Map<string, string>([
	["txt", "txt"],
	["asm", "txt"],
	["sub", "txt"],
]);

const MSDosMap = new Map<string, string>([
	["txt", "txt"],
	["asm", "txt"],
	["bat", "txt"],
]);

/**
 * Run a2kit expecting to receive binary output
 *
 * @param args the a2kit arguments 
 * @param stdin the optional binary data that is piped in
 * @throws Error
 */
export function bin2bin(args: string[], stdin: Buffer | undefined) : Buffer {
	let res;
	if (stdin)
		res = spawnSync('a2kit', args, { timeout: 10000, input: stdin, windowsHide: true });
	else
		res = spawnSync('a2kit', args, { timeout: 10000, windowsHide: true });
	if ((res.status != 0 || res.error) && res.stderr) {
		throw new Error(`a2kit says: ${res.stderr}`);
	} else if ((res.status != 0 || res.error) && !res.stderr) {
		throw new Error(`error spawning a2kit (is it installed and in the path?)`);
	}
	return res.stdout;
}

/**
 * Run a2kit expecting to receive text output
 *
 * @param args the a2kit arguments 
 * @param stdin the optional binary data that is piped in
 * @throws Error
 */
export function bin2txt(args: string[], stdin: Buffer | undefined) : string {
	let res;
	if (stdin)
		res = spawnSync('a2kit', args, { timeout: 10000, input: stdin, windowsHide: true });
	else
		res = spawnSync('a2kit', args, { timeout: 10000, windowsHide: true });
	if ((res.status != 0 || res.error) && res.stderr) {
		throw new Error(`a2kit says: ${res.stderr}`);
	} else if ((res.status != 0 || res.error) && !res.stderr) {
		throw new Error(`error spawning a2kit (is it installed and in the path?)`);
	}
	return `${res.stdout}`;
}

interface FileImageType {
	fimg_version: string;
	file_system: string;
	chunk_len: number;
	eof: string;
	fs_type: string;
	aux: string;
	access: string;
	created: string;
	modified: string;
	version: string;
	min_version: string;
	chunks: {[Key: string]: string};
}

export class FileImage {
	img: FileImageType;
	constructor(json_str: string) {
		this.img = JSON.parse(json_str);
	}
	verify(): boolean {
		if (this.img.fimg_version.slice(0, 2) != "2.")
			return false;
		return true;
	}
	block0(): number[] | undefined {
		const block = this.img.chunks["0"];
		if (!block)
			return;
		const ans = new Array<number>();
		if (block.length % 2 == 1) {
			console.log("length of hex string was odd");
			return;
		}
		for (let i = 0; i < block.length / 2; i++) {
			const byteValue = parseInt(block.slice(i * 2, i * 2 + 2), 16);
			if (isNaN(byteValue)) {
				console.log("hex string parsed as NaN");
				return;
			}
			ans.push(byteValue);
		}
		return ans;
	}
	/**
	 * Get the load address of an Apple binary file, returns 0 for non-Apple
	 */
	getLoadAddr(): number {
		const seq = this.block0();
		if (!seq)
			return 0;
		if (this.img.file_system == "a2 dos") {
			if (this.img.fs_type != "04" && this.img.fs_type != "84")
				return 0;
			if (seq.length < 4)
				return 0;
			const loadAddr = seq[0] + 256 * seq[1];
			return loadAddr;
		}
		if (this.img.file_system == "prodos") {
			if (this.img.fs_type != "06" && this.img.fs_type != "FF" && this.img.fs_type != "ff")
				return 0;
			const aux = this.img.aux;
			if (aux.length < 4)
				return 0;
			const loadAddr = parseInt(aux.slice(0, 2), 16) + 256 * parseInt(aux.slice(2, 4), 16);
			if (isNaN(loadAddr))
				return 0;
			return loadAddr;
		}
		return 0;
	}
	/**
	 * Determine the best a2kit type specifier for this file image
	 */
	getBestType(): string {
		const fs = this.img.file_system;
		let typ;
		if (fs == "a2 dos") {
			typ = A2DosMap.get(this.img.fs_type.toLowerCase());
		} else if (fs == "prodos") {
			typ = ProDosMap.get(this.img.fs_type.toLowerCase());
		} else if (fs == "a2 pascal") {
			typ = PascalMap.get(this.img.fs_type.toLowerCase());
		} else if (fs == "fat") {
			const asc = Buffer.from(this.img.fs_type, "hex").toString().toLowerCase();
			typ = MSDosMap.get(asc);
		} else if (fs == "cpm") {
			const asc = Buffer.from(this.img.fs_type, "hex").toString().toLowerCase();
			typ = CpmMap.get(asc);
		}
		return typ ? typ : "bin";
	}
	/** Get the best text representation
	 * @throws Error
	 * */
	getText(path: string, stdin: Buffer): string {
		let typ = this.getBestType();
		if (typ == "txt") {
			if (this.img.file_system == "prodos" && this.img.aux != "0000") {
				return bin2txt(["get", "-f", path, "-t", "rec"], stdin);
			}
			return bin2txt(["get", "-f", path, "-t", typ], stdin);
		} else if (typ == "atok" || typ == "itok") {
			const tokens = bin2bin(["get", "-f", path, "-t", typ], stdin);
			return bin2txt(["detokenize", "-t", typ], tokens);
		} else {
			const baseAddr = this.getLoadAddr();
			const dat = bin2bin(["get", "-f", path, "-t", typ], stdin);
			return hexDump(dat, baseAddr);
		}
	}
	/** Get a hex dump
	 * @throws Error
	 * */
	getHex(path: string, stdin: Buffer, raw: boolean): string {
		const baseAddr = this.getLoadAddr();
		if (raw) {
			const dat = bin2bin(["get", "-f", path, "-t", "raw", "--trunc"], stdin);
			return hexDump(dat, baseAddr);
		} else {
			const dat = bin2bin(["get", "-f", path, "-t", "bin"], stdin);
			return hexDump(dat, baseAddr);
		}
	}
}

