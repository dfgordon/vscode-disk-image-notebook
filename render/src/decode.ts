
const A2DosMapDir = new Map<number, string>([
	[0x00, "T"],
	[0x01, "I"],
	[0x02, "A"],
	[0x04, "B"],
	[0x80, "T"],
	[0x81, "I"],
	[0x82, "A"],
	[0x84, "B"],
]);

const ProDosMapDir = new Map<number, string>([
    [0x00, "???"],
    [0x01, "BAD"],
    [0x02, "PCD"], // Pascal code
    [0x03, "PTX"], // Pascal text
    [0x04, "TXT"],
    [0x05, "PDA"], // Pascal data
    [0x06, "BIN"],
    [0x07, "FON"], // SOS
    [0x08, "FOT"], // Photo
    [0x09, "BAS"], // SOS
    [0x0a, "DAT"], // SOS
    [0x0b, "WRD"], // SOS
    [0x0c, "SYS"], // SOS
    [0x0f, "DIR"],
    [0x10, "RPD"], // SOS
    [0x11, "RPX"], // SOS
    [0x12, "AFD"], // SOS
    [0x13, "AFM"], // SOS
    [0x14, "AFR"], // SOS
    [0x15, "SLB"], // SOS
    [0x19, "AWD"], // AppleWorks Data Base
    [0x1a, "AWW"], // AppleWorks Word Processor
    [0x1b, "AWS"], // AppleWorks Spreadsheet
    [0xef, "PSA"], // Pascal area
    [0xf0, "CMD"],
    [0xf1, "USR"],
    [0xf2, "USR"],
    [0xf3, "USR"],
    [0xf4, "USR"],
    [0xf5, "USR"],
    [0xf6, "USR"],
    [0xf7, "USR"],
    [0xf8, "USR"],
    [0xfa, "INT"],
    [0xfb, "IVR"],
    [0xfc, "BAS"],
    [0xfd, "VAR"],
    [0xfe, "REL"],
    [0xff, "SYS"]
]);

const PascalMapDir = new Map<number, string>([
    [0x00, "NONE"],
    [0x01, "BAD"],
    [0x02, "CODE"],
    [0x03, "TEXT"],
    [0x04, "INFO"],
    [0x05, "DATA"],
    [0x06, "GRAF"],
    [0x07, "FOTO"],
    [0x08, "SECURE"]
]);

export function prettyType(code: string, fs_name: string) : string {
    if (fs_name == "a2 dos") {
        // in the meta object write-protect is encoded separately from type
        const typ = parseInt(code, 16);
        if (A2DosMapDir.has(typ)) {
            return A2DosMapDir.get(typ);
        }
    } else if (fs_name == "prodos") {
        const typ = parseInt(code, 16);
        if (ProDosMapDir.has(typ)) {
            return ProDosMapDir.get(typ);
        }
    } else if (fs_name == "a2 pascal") {
        const typ = parseInt(code.substring(0,2), 16);
        if (PascalMapDir.has(typ)) {
            return PascalMapDir.get(typ);
        }
    }
    return code;
}