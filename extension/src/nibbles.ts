import { bin2txt, bin2bin } from './a2kit.js';

export const FluxOptions = {
    FM: 0,
    MFM: 1,
    GCR: 2
} as const ;

export type FluxChoice = typeof FluxOptions[keyof typeof FluxOptions];

export const NibbleOptions = {
    None: 0,
    N44: 1,
    N53: 2,
    N62: 3
} as const ;

export type NibbleChoice = typeof NibbleOptions[keyof typeof NibbleOptions];

export class NibbleDesc {
    flux: FluxChoice;
    addrNib: NibbleChoice;
    addrProlog: number[];
    addrEpilog: number[];
    dataNib: NibbleChoice;
    dataProlog: number[];
    dataEpilog: number[];
    constructor(flux: FluxChoice, addrNib: NibbleChoice, addrProlog: number[], addrEpilog: number[], dataNib: NibbleChoice, dataProlog: number[], dataEpilog: number[]) {
        this.flux = flux;
        this.addrNib = addrNib;
        this.addrProlog = addrProlog;
        this.addrEpilog = addrEpilog;
        this.dataNib = dataNib;
        this.dataProlog = dataProlog;
        this.dataEpilog = dataEpilog;
    }
}

export const Std13: NibbleDesc = {
    flux: FluxOptions.GCR,
    addrNib: NibbleOptions.N44,
    addrProlog: [0xd5, 0xaa, 0xb5],
    addrEpilog: [0xde, 0xaa, 0xeb],
    dataNib: NibbleOptions.N53,
    dataProlog: [0xd5, 0xaa, 0xad],
    dataEpilog: [0xde, 0xaa, 0xeb]
}

export const Std16: NibbleDesc = {
    flux: FluxOptions.GCR,
    addrNib: NibbleOptions.N44,
    addrProlog: [0xd5, 0xaa, 0x96],
    addrEpilog: [0xde, 0xaa, 0xeb],
    dataNib: NibbleOptions.N62,
    dataProlog: [0xd5, 0xaa, 0xad],
    dataEpilog: [0xde, 0xaa, 0xeb]
}

export const Std35: NibbleDesc = {
    flux: FluxOptions.GCR,
    addrNib: NibbleOptions.N62,
    addrProlog: [0xd5, 0xaa, 0x96],
    addrEpilog: [0xde, 0xaa, 0x00],
    dataNib: NibbleOptions.N62,
    dataProlog: [0xd5, 0xaa, 0xad],
    dataEpilog: [0xde, 0xaa, 0x00]
}

const INVALID_NIB_BYTE = 0xff;

const DISK_BYTES_53 = [
    0xab, 0xad, 0xae, 0xaf, 0xb5, 0xb6, 0xb7, 0xba,
    0xbb, 0xbd, 0xbe, 0xbf, 0xd6, 0xd7, 0xda, 0xdb,
    0xdd, 0xde, 0xdf, 0xea, 0xeb, 0xed, 0xee, 0xef,
    0xf5, 0xf6, 0xf7, 0xfa, 0xfb, 0xfd, 0xfe, 0xff
];

const DISK_BYTES_62 = [
    0x96, 0x97, 0x9a, 0x9b, 0x9d, 0x9e, 0x9f, 0xa6,
    0xa7, 0xab, 0xac, 0xad, 0xae, 0xaf, 0xb2, 0xb3,
    0xb4, 0xb5, 0xb6, 0xb7, 0xb9, 0xba, 0xbb, 0xbc,
    0xbd, 0xbe, 0xbf, 0xcb, 0xcd, 0xce, 0xcf, 0xd3,
    0xd6, 0xd7, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
    0xdf, 0xe5, 0xe6, 0xe7, 0xe9, 0xea, 0xeb, 0xec,
    0xed, 0xee, 0xef, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6,
    0xf7, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff
];

// function invert_53() : number[] {
//     const ans = new Array<number>(256);
//     ans.fill(INVALID_NIB_BYTE);
//     for (let i = 0; i < 32; i++) {
//         ans[DISK_BYTES_53[i]] = i;
//     }
//     return ans;
// }

function invert_62() : number[] {
    const ans = new Array<number>(256);
    ans.fill(INVALID_NIB_BYTE);
    for (let i = 0; i < 64; i++) {
        ans[DISK_BYTES_62[i]] = i;
    }
    return ans;
}

/** decode two 4&4 nibbles, returning an ordinary byte value */
function decode_44(nibs: [number,number]) : number {
    return ((nibs[0] << 1) | 0x01) & nibs[1]
}

// /** decode a 5&3 nibble, returning a 5-bit value */
// function decode_53(byte: number,inv: number[]) : number {
//     return inv[byte];
// }

/** decode a 6&2 nibble, returning a 6-bit value */
function decode_62(byte: number,inv: number[]) : number {
    return inv[byte];
}

/** Get display string for a track including mnemonics
 * @track should already be resolved into nibbles by the backend
 * @flux how are the flux transitions encoded
 * @nib how is the bitstream encoded
 */
export function trackDump(trk: Uint8Array, nibs: NibbleDesc): string {
    const start_addr = 0;
    let ans = "";
    let slice_start = 0;
    let addr_count = 0;
    let err_count = 0;
    let in_addr_field = false;
    const [apro, aepi, dpro, depi] = [nibs.addrProlog, nibs.addrEpilog, nibs.dataProlog, nibs.dataEpilog];
    let nib_table: number[] | undefined;
    if (nibs.dataNib == NibbleOptions.N53) {
        nib_table = DISK_BYTES_53;
    } else if (nibs.dataNib == NibbleOptions.N62) {
        nib_table = DISK_BYTES_62;
    }
    if (!nib_table) {
        return "invalid nibble type";
    }
    let addr_nib_count = 8;
    if (nibs.addrNib != NibbleOptions.N44) {
        addr_nib_count = 5;
    }
    const inv = invert_62();
    let slice_end = 0;
    do {
        const row_label = start_addr + slice_start;
        slice_end = slice_start + 16;
        if (slice_end > trk.byteLength) {
            slice_end = trk.byteLength;
        }
        let mnemonics = "";
        for (let i = slice_start; i < slice_end; i++) {
            const bak = i >= 0 ? trk[i - 1] : 0;
            const fwd = i + 1 < trk.byteLength ? trk[i + 1] : 0;
            if (!nib_table.includes(trk[i]) && trk[i]!=0xaa && trk[i]!=0xd5) {
                mnemonics += "?";
                err_count += 1;
            } else if (addr_count > 0) {
                if (nibs.addrNib == NibbleOptions.N62) {
                    const val = decode_62(trk[i], inv);
                    if (val < 16) {
                        mnemonics += val.toString(16);
                    } else if (val != INVALID_NIB_BYTE) {
                        mnemonics += "^";
                    } else {
                        mnemonics += "?";
                    }
                } else if (nibs.addrNib == NibbleOptions.N44) {
                    if (addr_count % 2 == 1) {
                        mnemonics += (decode_44([trk[i], fwd]) >> 4).toString(16);
                    } else {
                        mnemonics += (decode_44([bak, trk[i]]) & 0x0f).toString(16);
                    }
                } else {
                    mnemonics += "?";
                }
                addr_count += 1;
            } else {
                if (bak == 0xff && trk[i] == 0xff) mnemonics += ">";
                else if (trk[i] == 0xff && fwd == 0xff) mnemonics += ">";
                // address prolog
                else if (trk[i] == apro[0] && fwd == apro[1]) mnemonics += "(";
                else if (bak == apro[0] && trk[i] == apro[1] && fwd == apro[2]) {
                    in_addr_field = true;
                    mnemonics += "A";
                }
                else if (bak == apro[1] && trk[i] == apro[2]) {
                    mnemonics += ":";
                    addr_count = 1;
                }
                // data prolog
                else if (trk[i] == dpro[0] && fwd == dpro[1]) mnemonics += "(";
                else if (bak == dpro[0] && trk[i] == dpro[1] && fwd == dpro[2]) mnemonics += "D";
                else if (bak == dpro[1] && trk[i] == dpro[2]) mnemonics += ":";
                // address epilog
                else if (trk[i] == aepi[0] && fwd == aepi[1]) mnemonics += ":";
                else if (bak == aepi[0] && trk[i] == aepi[1]) mnemonics += in_addr_field ? "A" : "D";
                else if (bak == aepi[1]) {
                    in_addr_field = false;
                    mnemonics += ")";
                }
                // data epilog
                else if (trk[i] == depi[0] && fwd == depi[1]) mnemonics += ":";
                else if (bak == depi[0] && trk[i] == depi[1]) mnemonics += in_addr_field ? "A" : "D";
                else if (bak == depi[1]) {
                    in_addr_field = false;
                    mnemonics += ")";
                }
                else if (trk[i] == 0xd5) mnemonics += "R";
                else if (trk[i] == 0xaa) mnemonics += "R";
                else mnemonics += ".";
            }
            if (addr_count>addr_nib_count) {
                addr_count = 0;
            }
        }
        mnemonics.padEnd(16 - mnemonics.length, " ");
        ans += row_label.toString(16).padStart(4, "0").toUpperCase() + " : ";
        for (let i = slice_start; i < slice_end; i++) {
            ans += trk[i].toString(16).padStart(2, "0").toUpperCase() + " ";
        }
        for (let i = slice_end; i < slice_start + 16; i++) {
            ans += "   ";
        }
        ans += "|" + mnemonics + "|\n";
        slice_start += 16;
    } while (slice_end < trk.length)
    if (err_count > 0) {
        ans += "\n"
        ans += "Encountered " + err_count + " invalid bytes\n";
    }
    return ans;
}

/** use the image data to find the nibble descriptor.
 * @throws Error
 */
export function GetNibbleDesc(img_buf: Buffer): NibbleDesc | undefined {
    const raw_meta = bin2txt(["get", "-t", "meta"], img_buf);
    const meta = JSON.parse(raw_meta);
    let defer13_16 = false;
    if (meta.nib) {
        defer13_16 = true;
    } else if (meta["2mg"]?.header?.img_fmt?._raw == "02000000") {
        defer13_16 = true;
    } else if (meta.woz1) {
        defer13_16 = true;
    } else if (meta.woz2?.info?.disk_type?._raw == "01") {
        if (meta.woz2?.info?.boot_sector_format?._raw == "01")
            return Std16;
        else if (meta.woz2?.info?.boot_sector_format?._raw == "02")
            return Std13;
        else {
            defer13_16 = true;
        }
    } else if (meta.woz2?.info?.disk_type?._raw == "02") {
        return Std35;
    }
    if (!defer13_16)
        return undefined;
    try {
        bin2bin(["get", "-t", "sec", "-f", "0,0,15"], img_buf);
        return Std16;
    } catch {
        return Std13;
    }
}