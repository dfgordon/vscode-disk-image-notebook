import { spawnSync, SpawnSyncReturns } from 'child_process';
import { hexDump } from './util.js'
import { ObjectCode } from '../../messages/src/base.js';
import { serverCommand } from './extension.js';

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
 * @param method the decoding methodology "auto", "fast", "analyze", "emulate"
 * @param fmt JSON string defining format of tracks
 * @throws Error
 */
export function bin2bin(args0: string[], stdin: Uint8Array | undefined, method: string | undefined, fmt: string | undefined) : Uint8Array {
	let res: SpawnSyncReturns<Buffer>;
	if (!serverCommand) {
		throw new Error("unable to find backend");
	}
	const args = [];
	for (const arg of args0) {
		args.push(arg);
	}
	if (fmt) {
		args.push("--pro");
		args.push(fmt);
	}
	if (method) {
		args.push("--method");
		args.push(method);
	}
	if (stdin)
		res = spawnSync(serverCommand, args, { timeout: 10000, input: stdin, windowsHide: true, maxBuffer: 32*1024*1024 });
	else
		res = spawnSync(serverCommand, args, { timeout: 10000, windowsHide: true, maxBuffer: 32*1024*1024 });
	if ((res.status != 0 || res.error) && res.stderr) {
		throw new Error(`a2kit says: ${res.stderr}`);
	} else if ((res.status != 0 || res.error) && !res.stderr) {
		throw new Error(`error spawning a2kit (is it installed and in the path?)`);
	}
	return Uint8Array.from(res.stdout);
}

/**
 * Run a2kit expecting to receive text output
 *
 * @param args the a2kit arguments 
 * @param stdin the optional binary data that is piped in
 * @param method the decoding methodology "auto", "fast", "analyze", "emulate"
 * @param fmt JSON string defining format of tracks
 * @throws Error
 */
export function bin2txt(args0: string[], stdin: Uint8Array | undefined, method: string | undefined, fmt: string | undefined) : string {
	let res: SpawnSyncReturns<Buffer>;
	if (!serverCommand) {
		throw new Error("unable to find backend");
	}
	const args = [];
	for (const arg of args0) {
		args.push(arg);
	}
	if (fmt) {
		args.push("--pro");
		args.push(fmt);
	}
	if (method) {
		args.push("--method");
		args.push(method);
	}
	if (stdin)
		res = spawnSync(serverCommand, args, { timeout: 10000, input: stdin, windowsHide: true, maxBuffer: 32*1024*1024 });
	else
		res = spawnSync(serverCommand, args, { timeout: 10000, windowsHide: true, maxBuffer: 32*1024*1024 });
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
	accessed: string,
	created: string;
	modified: string;
	version: string;
	min_version: string;
	full_path: string,
	chunks: {[Key: string]: string};
}

export class FileImage {
	img: FileImageType;
	constructor(json_str: string) {
		this.img = JSON.parse(json_str);
	}
	verify(): boolean {
		const vers = this.img.fimg_version.split(".").map((s) => parseInt(s));
		if (vers < [2, 1, 0] || vers >= [3, 0, 0]) {
			return false;
		}
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
	/** Get the best display representation, and maybe the object code. If we think
	 * this is text or tokens, we return [null,string].
	 * @returns [maybe object code, string for display]
	 * @throws Error
	 * */
	getText(path: string, stdin: Uint8Array, method: string | undefined, fmt: string | undefined): [ObjectCode | null, string] {
		const typ = this.getBestType();
		if (typ == "txt") {
			if (this.img.file_system == "prodos" && this.img.aux != "0000") {
				return [null, bin2txt(["get", "-f", path, "-t", "rec", "--indent", "4"], stdin, method, fmt)];
			}
			if ((this.img.file_system == "prodos" || this.img.file_system == "a2 dos") && path.endsWith(".S")) {
				try {
					const tokens = bin2bin(["get", "-f", path, "-t", "mtok"], stdin, method, fmt);
					return [null, bin2txt(["detokenize", "-t", "mtok"], tokens, undefined, undefined)];
				} catch {
					console.log("attempt to interpret .S as Merlin failed");
				}
			}
			return [null, bin2txt(["get", "-f", path, "-t", typ], stdin, method, fmt)];
		} else if (typ == "atok" || typ == "itok") {
			const tokens = bin2bin(["get", "-f", path, "-t", typ], stdin, method, fmt);
			return [null, bin2txt(["detokenize", "-t", typ], tokens, undefined, undefined)];
		} else {
			const baseAddr = this.getLoadAddr();
			const dat = bin2bin(["get", "-f", path, "-t", typ], stdin, method, fmt);
			const hex = bin2txt(["get", "-f", path, "-t", typ, "--console"], stdin, method, fmt);
			if (baseAddr == 0) {
				// convert to unicode and see if we have 0xFFFD (replacement character), if not treat as text
				const tentative_string = Buffer.from(dat).toString();
				if (!tentative_string.includes('\ufffd'))
					return [null, tentative_string];
			}
			const objCode = new ObjectCode(baseAddr, dat);
			return [objCode, hex];
		}
	}
	/** Get a hex dump
	 * @throws Error
	 * */
	getHex(path: string, stdin: Uint8Array, raw: boolean, method: string | undefined, fmt: string | undefined): string {
		const baseAddr = this.getLoadAddr();
		if (raw) {
			return bin2txt(["get", "-f", path, "-t", "raw", "--trunc", "--console"], stdin, method, fmt);
		} else {
			return bin2txt(["get", "-f", path, "-t", "bin", "--console"], stdin, method, fmt);
		}
	}
	/** Get ObjectCode type using fimg and disk both
	 * @throws Error
	 * */
	getObjectCode(path: string, stdin: Uint8Array, method: string | undefined, fmt: string | undefined): ObjectCode {
		const baseAddr = this.getLoadAddr();
		const dat = bin2bin(["get", "-f", path, "-t", "bin"], stdin, method, fmt);
		return new ObjectCode(baseAddr, dat);
	}
}

