import { MessageBase, ObjectCode } from './base';

export class LoadNibbles extends MessageBase {
    static id = "dimg-LoadNibbles";
    ch: [number, number];
    constructor(cyl: number, head: number, hash: string) {
        super(hash);
        this.ch = [cyl, head];
    }
}

export class LoadSector extends MessageBase {
    static id = "dimg-LoadSector";
    trk: number;
    angle: number;
    constructor(trk: number, angle: number, hash: string) {
        super(hash);
        this.trk = trk;
        this.angle = angle;
    }
}

export class LoadBlock extends MessageBase {
    static id = "dimg-LoadBlock";
    block: number;
    constructor(block: number, hash: string) {
        super(hash);
        this.block = block;
    }
}

export class ReturnedSector extends MessageBase {
    static id = "dimg-returnedSector";
    hex: string;
    objectCode: ObjectCode | null;
    constructor(hex: string, objectCode: ObjectCode | null, hash: string) {
        super(hash);
        this.hex = hex;
        this.objectCode = objectCode;
    }
}

export class ReturnedBlock extends MessageBase {
    static id = "dimg-returnedBlock";
    hex: string;
    objectCode: ObjectCode | null;
    constructor(hex: string, objectCode: ObjectCode | null, hash: string) {
        super(hash);
        this.hex = hex;
        this.objectCode = objectCode;
    }
}

export class ReturnedNibbles extends MessageBase {
    static id = "dimg-returnedNibbles";
    hex: string;
    constructor(hex: string, hash: string) {
        super(hash);
        this.hex = hex;
    }
}
