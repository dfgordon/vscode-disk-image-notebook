import { MessageBase, DirectoryRow } from './base';

export class ObjectCode {
    load_addr: number;
    code: Uint8Array;
    constructor(load_addr: number, code: Uint8Array) {
        this.load_addr = load_addr;
        this.code = code;
    }
}

export class ChangeDirectory extends MessageBase {
    static id = "dimg-ChangeDirectory";
    curr_path: string;
    subdir: string;
    constructor(curr_path: string,subdir: string, hash: string) {
        super(hash);
        this.curr_path = curr_path;
        this.subdir = subdir;
    }
}

export class ReturnedSubdirectory extends MessageBase {
    static id = "dimg-returnedSubdirectory";
    new_path: string;
    rows: DirectoryRow[];
    constructor(new_path: string,rows: DirectoryRow[], hash: string) {
        super(hash);
        this.new_path = new_path;
        this.rows = rows;
    }
}

export class ReturnedFile extends MessageBase {
    static id = "dimg-returnedFile";
    new_path: string;
    content: string;
    objectCode: ObjectCode | null;
    typ: string;
    constructor(new_path: string, content: string, objectCode: ObjectCode | null, typ: string, hash: string) {
        super(hash);
        this.new_path = new_path;
        this.content = content;
        this.objectCode = objectCode;
        this.typ = typ;
    }
}

export class OpenFile extends MessageBase {
    static id = "dimg-OpenFile";
    content: string;
    fs: string;
    typ: string;
    constructor(content: string,fs: string,typ: string,hash: string) {
        super(hash);
        this.content = content;
        this.fs = fs;
        this.typ = typ;
    }
}

export class OpenDasm extends MessageBase {
    static id = "dimg-OpenDasm";
    objectCode: ObjectCode;
    xc: number;
    mx: string;
    constructor(objectCode: ObjectCode, xc: number, mx: string, hash: string) {
        super(hash);
        this.objectCode = objectCode;
        this.xc = xc;
        this.mx = mx;
    }
}
