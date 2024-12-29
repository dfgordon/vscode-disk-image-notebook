import * as vscode from 'vscode';

import * as theme from '../../messages/src/themes.js';
import * as mess_trk from '../../messages/src/trk.js';
import * as mess_xp from '../../messages/src/explore.js';
import * as mess_base from '../../messages/src/base.js';
import { bin2bin, bin2txt, FileImage } from './a2kit.js';
import * as util from './util.js';
import * as nib from './nibbles.js';
import { type DiskImageController } from './extension.js';

interface req_event
{
    readonly editor: vscode.NotebookEditor;
    readonly message: any;
};

export function create_interactive(this: DiskImageController, notebook: vscode.NotebookDocument, img_buf: Buffer): Array<vscode.NotebookCellOutputItem> {
    const out_cells = new Array<vscode.NotebookCellOutputItem>();
    let tree: util.Tree | null = null;
    let geometry: mess_base.Geometry | null = null;
    let stat: mess_base.Stat | null = null;
    let root_path: string | null = null;
    let root_files: mess_base.DirectoryRow[] | null = null;
    let start_path: string | null = null;
    let start_files: mess_base.DirectoryRow[] | null = null;
    try {
        tree = this.updateTree(notebook.metadata.img_hash, img_buf);
        stat = this.updateStatistics(notebook.metadata.img_hash, img_buf);
        [root_path, root_files] = util.getFiles(util.rootPath(tree), tree);
        // if CP/M has a user 0, we should start off there for convenience
        if (stat.fs_name == "cpm" && stat.users.includes("0")) {
            [start_path, start_files] = util.getFiles("/0/", tree);
        } else {
            [start_path, start_files] = [root_path, root_files];
        }
    } catch (Error) {
        console.log("could not determine disk file system");
    }
    try {
        geometry = this.updateGeometry(notebook.metadata.img_hash, img_buf);
    } catch (Error) {
        console.log("could not determine disk geometry");
    }
    const has_nibbles = this.testNibbles(notebook.metadata.img_has, img_buf);
    if (stat == null && (geometry == null || geometry.tracks == null)) {
        out_cells.push(vscode.NotebookCellOutputItem.text("Disk geometry could not be determined"));
        out_cells.push(vscode.NotebookCellOutputItem.text("You may still be able to view tracks in a code cell"));
    } else {
        const config = vscode.workspace.getConfiguration("diskimage");
        const theme_str = config.get('interactiveTheme') as string;
        let color_theme = theme.AmberDays;
        if (theme_str == "Sith Lord") {
            color_theme = theme.SithLord;
        } else if (theme_str == "True Neutral") {
            color_theme = theme.TrueNeutral;
        }
        const create_mess: mess_base.CreateInteractive = {
            img_hash: notebook.metadata.img_hash,
            has_nibbles,
            geometry,
            stat,
            root_path,
            root_files,
            start_path,
            start_files,
            color_theme
        };
        out_cells.push(vscode.NotebookCellOutputItem.json(create_mess, 'x-application/disk-image-interactive'));
    }
    return out_cells;
}

export function handle_request(this: DiskImageController, event: req_event) {
    if (!event.message.img_hash) {
        console.log("message not handled by controller (no hash)")
        return;
    }
    const img_buf = this.data_map.get(event.message.img_hash);
    if (!img_buf) {
        vscode.window.showErrorMessage("no buffer, if it was deleted to save resources, re-running the code cell might restore it")
        console.log("message not handled by controller (no buffer)")
        return;
    }
    if (mess_trk.LoadSector.test(event.message)) {
        const messg: mess_trk.LoadSector = event.message;
        const track = this.geometry_map.get(messg.img_hash)?.tracks[messg.trk];
        if (!track) {
            this.vs_messager.postMessage(new mess_trk.ReturnedSector("disk geometry missing", null, messg.img_hash));
            return;
        }
        //console.log("loading sector " + messg.rzq);
        // form address sequence to find this angle
        let seq = "";
        let offset = 0;
        for (let q = 0; q <= messg.angle; q++) {
            seq += track.cylinder.toString() + "," + track.head.toString() + "," + track.chs_map[q][2].toString();
            if (q < messg.angle) {
                seq += ",,";
                // chs_map[q][3] includes tag bytes, but sector data will not, so we apply a mask that
                // handles all cases we can think of
                offset += track.chs_map[q][3] & 0b1111111111000000;
            }
        }
        try {
            const res = bin2bin(["get", "-t", "sec", "-f", seq], img_buf);
            const hex = util.hexDump(res.subarray(offset), 0);
            const obj = new mess_base.ObjectCode(0x800, util.parseHexDump(hex));
            this.vs_messager.postMessage(new mess_trk.ReturnedSector(hex, obj, messg.img_hash));
        } catch (error) {
            if (error instanceof Error)
                this.vs_messager.postMessage(new mess_trk.ReturnedSector(error.message, null, messg.img_hash));
        }
    } else if (mess_trk.LoadBlock.test(event.message)) {
        const messg: mess_trk.LoadBlock = event.message;
        //console.log("loading block " + messg.block);
        try {
            const res = bin2bin(["get", "-t", "block", "-f", messg.block.toString()], img_buf);
            const hex = util.hexDump(res, 0);
            const obj = new mess_base.ObjectCode(0x800, util.parseHexDump(hex));
            this.vs_messager.postMessage(new mess_trk.ReturnedBlock(hex, obj, messg.img_hash));
        } catch (error) {
            if (error instanceof Error)
                this.vs_messager.postMessage(new mess_trk.ReturnedBlock(error.message, null, messg.img_hash));
        }
    } else if (mess_trk.LoadNibbles.test(event.message)) {
        const messg: mess_trk.LoadNibbles = event.message;
        //console.log("loading nibbles " + messg.ch);
        const ch_str = messg.ch[0].toString() + "," + messg.ch[1].toString();
        try {
            const res = bin2bin(["get", "-t", "track", "-f", ch_str], img_buf);
            const nib_desc = nib.GetNibbleDesc(img_buf);
            if (nib_desc)
                this.vs_messager.postMessage(new mess_trk.ReturnedNibbles(nib.trackDump(res, nib_desc), messg.img_hash));
        } catch (error) {
            if (error instanceof Error)
                this.vs_messager.postMessage(new mess_trk.ReturnedNibbles(error.message, messg.img_hash));
        }
    } else if (mess_xp.ChangeDirectory.test(event.message)) {
        const messg: mess_xp.ChangeDirectory = event.message;
        const tree = this.updateTree(messg.img_hash, img_buf);
        const new_path = util.processDottedPath(messg.curr_path + messg.subdir + "/", tree.file_system, tree.label.name);
        const [new_path_actual, rows] = util.getFiles(new_path, tree);
        if (rows) {
            this.vs_messager.postMessage(new mess_xp.ReturnedSubdirectory(new_path_actual, rows, messg.img_hash));
        }
        else {
            const cpm_corrected = tree.file_system == "cpm" ? util.cpmForm(new_path_actual) : new_path_actual;
            const res = bin2txt(["get", "-f", cpm_corrected, "-t", "any"], img_buf);
            const fimg = new FileImage(res);
            const [objCode, content] = fimg.getText(cpm_corrected, img_buf);
            this.vs_messager.postMessage(new mess_xp.ReturnedFile(new_path_actual, content, objCode, fimg.img.fs_type, messg.img_hash));
        }
    } else if (mess_xp.OpenFile.test(event.message)) {
        const messg: mess_xp.OpenFile = event.message;
        const typ = parseInt(messg.typ, 16);
        let lang = 'plaintext';
        if (messg.fs == "prodos") {
            if (typ == 0xfa)
                lang = 'integerbasic';
            if (typ == 0xfc)
                lang = 'applesoft';
        } else if (messg.fs == "a2 dos") {
            if ((typ & 0x7f) == 0x01)
                lang = 'integerbasic';
            if ((typ & 0x7f) == 0x02)
                lang = 'applesoft'
        } else if (messg.fs == "a2 pascal") {
            if ((messg.typ == "0300"))
                lang = 'pascal';
        }
        vscode.workspace.openTextDocument({ content: messg.content, language: lang }).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    } else if (mess_base.OpenDasm.test(event.message)) {
        const mess: mess_base.OpenDasm = event.message;
        let proc;
        if (mess.xc == 0) {
            proc = "6502";
        } else if (mess.xc == 1) {
            proc = "65c02";
        } else {
            proc = "65816";
        }
        let load_addr = mess.objectCode.load_addr;
        if (load_addr == 0) {
            load_addr = 8192; // probably a system file
        }
        try {
            const buf = Buffer.from(mess.objectCode.code);
            const res = bin2txt(["dasm", "-p", proc, "--mx", mess.mx, "--org", load_addr.toString()], buf);
            vscode.workspace.openTextDocument({ content: res, language: "merlin6502" }).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        } catch (err) {
            console.log(err);
        }
    }
}