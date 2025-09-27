import * as theme from './themes.js';

export class MessageBase {
    static id = "";
    command: string;
    img_hash: string;
    constructor(hash: string) {
        this.command = (<any>this.constructor).id;
        this.img_hash = hash;
    }
    static test(obj: MessageBase) {
        return obj.command && obj.command == this.id;
    }
}

export class ObjectCode {
    load_addr: number;
    code: string;
    constructor(load_addr: number, code: Uint8Array) {
        this.load_addr = load_addr;
        this.code = Buffer.from(code).toString("hex");
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

export interface Stat {
    fs_name: string,
    label: string,
    users: string[],
    block_size: number,
    block_beg: number,
    block_end: number,
    free_blocks: number,
    raw: any
}

interface Solution {
    flux_code: string,
    addr_code: string,
    nibble_code: string,
    speed_kbps: number,
    density: number | null,
    addr_map: [string],
    size_map: [number],
    addr_type: string,
    addr_mask: [number]
}

interface Summary {
    cylinders: number,
    heads: number,
    blank_tracks: number,
    solved_tracks: number,
    unsolved_tracks: number,
    last_blank_track: number | null,
    last_solved_track: number | null,
    last_unsolved_track: number | null,
    steps_per_cyl: number
}

export interface Track {
    cylinder: number,
    head: number,
    solution: Solution | string,
}

export interface Geometry {
    package: string,
    summary: Summary,
    tracks: Track[]
}

export interface DirectoryRow {
    name: string,
    meta: any
}

export class CreateInteractive {
    img_hash: string;
    has_nibbles: boolean;
    geometry: Geometry | null;
    stat: Stat | null;
    root_files: DirectoryRow[] | null;
    root_path: string | null;
    start_files: DirectoryRow[] | null;
    start_path: string | null;
    color_theme: theme.ThemeColors;
}

export class ReferencesWereDeleted extends MessageBase {
    static id = "dimg-referencesWereDeleted";
}

export class ChangeMethod extends MessageBase {
    static id = "dimg-changeMethod";
    content: string;
    constructor(content: string, hash: string) {
        super(hash);
        this.content = content;
    }
}

export class MethodChanged extends MessageBase {
    static id = "dimg-methodChanged";
    content: string;
    constructor(content: string, hash: string) {
        super(hash);
        this.content = content;
    }
}