import * as theme from './themes.js';

export class MessageBase {
    static id = "";
    command: string;
    img_hash: string;
    constructor(hash: string) {
        this.command = (<any>this.constructor).id;
        this.img_hash = hash;
    }
    static test(obj: any) {
        return obj.command && obj.command == this.id;
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

export interface Track {
    cylinder: number,
    head: number,
    flux_code: string,
    nibble_code: string,
    chs_map: [[number,number,number]]
}

export interface Geometry {
    package: string,
    tracks: Track[]
}

export interface DirectoryRow {
    name: string,
    meta: any
}

export class CreateInteractive {
    img_hash: string;
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
