import type { RendererContext } from 'vscode-notebook-renderer';
import { useState } from 'preact/hooks'
import { html } from 'htm/preact';
import * as mess_base from '../../messages/src/base.js';
import * as mess_trk from '../../messages/src/trk.js';
import * as mess_theme from '../../messages/src/themes.js';
import { DasmMenu, PostOpenDasm } from './dasm.js';

export function StartingSector(chs_map: [[number, number, number]]): number {
    let sec = chs_map[0][2];
    for (const chs of chs_map) {
        if (chs[2] < sec)
            sec = chs[2]
    }
    return sec;
}

export type DisplaySectorProps = {
    img_hash: string,
    geometry: mess_base.Geometry,
    ctx: RendererContext<any>,
    startingDisplay: string,
    color_theme: mess_theme.ThemeColors
};

export type DisplayBlockProps = {
    img_hash: string,
    stat: mess_base.Stat,
    ctx: RendererContext<any>,
    startingDisplay: string,
    color_theme: mess_theme.ThemeColors
};

export type DisplayNibbleProps = {
    img_hash: string,
    geometry: mess_base.Geometry,
    ctx: RendererContext<any>,
    startingDisplay: string
};

export function DisplayNibbles(props: DisplayNibbleProps) {
    //console.log("enter nibble renderer");
    const [trk, SetTrk] = useState(0);
    const [cyl, SetCyl] = useState(0);
    const [head, SetHead] = useState(0);
    const [hex, SetHex] = useState(props.startingDisplay);
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedNibbles.test(messg) && messg.img_hash == props.img_hash) {
            SetHex(messg.hex);
        }
    });
    const onTrk = (event: Event) => {
        if (event.target instanceof HTMLInputElement) {
            const updated = event.target.valueAsNumber;
            const updatedCyl = props.geometry.tracks[updated].cylinder;
            const updatedHead = props.geometry.tracks[updated].head;
            SetTrk(updated);
            SetCyl(updatedCyl);
            SetHead(updatedHead);
            props.ctx.postMessage(new mess_trk.LoadNibbles(updatedCyl, updatedHead, props.img_hash));
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <table>
        <tr>
          <td>Track</td><td><input type="number" min=0 max=${props.geometry.tracks.length - 1} value=${trk} onInput=${onTrk} ></input></td>
          <td>(CH ${cyl},${head})</td>
        </tr>
      </table>
      </div>
      <div>
      <pre>
      ${hex}
      </pre>
      </div>
    `;
}

export function DisplaySector(props: DisplaySectorProps) {
    //console.log("enter sector renderer");
    const [trk, SetTrk] = useState(0);
    const [cyl, SetCyl] = useState(0);
    const [head, SetHead] = useState(0);
    const [sec, SetSec] = useState(StartingSector(props.geometry.tracks[0].chs_map));
    const [hex, SetHex] = useState(props.startingDisplay);
    const [objectCode, setObjectCode] = useState(null);
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedSector.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_trk.ReturnedSector = messg;
            SetHex(tm.hex);
            setObjectCode(tm.objectCode);
        }
    });
    const onTrk = (event: Event) => {
        if (event.target instanceof HTMLInputElement) {
            const updated = event.target.valueAsNumber;
            const updatedCyl = props.geometry.tracks[updated].cylinder;
            const updatedHead = props.geometry.tracks[updated].head;
            SetTrk(updated);
            SetCyl(updatedCyl);
            SetHead(updatedHead);
            props.ctx.postMessage(new mess_trk.LoadSector(updatedCyl, updatedHead, sec, props.img_hash));
        }
    }
    const onSec = (event: Event) => {
        if (event.target instanceof HTMLInputElement) {
            const updated = event.target.valueAsNumber;
            SetSec(updated);
            props.ctx.postMessage(new mess_trk.LoadSector(cyl, head, updated, props.img_hash));
        }
    }
    const onDasm = (event: Event) => {
        if (event.target instanceof HTMLElement && objectCode) {
            PostOpenDasm(props.ctx, objectCode, event.target.textContent, props.img_hash);
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <table>
        <tr>
          <td>Track</td><td><input type="number" min=0 max=${props.geometry.tracks.length - 1} value=${trk} onInput=${onTrk} ></input></td>
          <td>Sector</td><td><input type="number" min=0 max=100 value=${sec} onInput=${onSec}></input></td>
          <td>(CHS ${cyl},${head},${sec})</td>
          <td>${DasmMenu({ name: "DASM", color_theme: props.color_theme, callback: onDasm })}</td>
        </tr>
      </table>
      </div>
      <div>
      <pre>
      ${hex}
      </pre>
      </div>
    `;
}

export function DisplayBlock(props: DisplayBlockProps) {
    //console.log("enter block renderer");
    const [block, SetBlock] = useState(props.stat.block_beg);
    const [hex, SetHex] = useState(props.startingDisplay);
    const [objectCode, setObjectCode] = useState(null);
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedBlock.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_trk.ReturnedBlock = messg;
            SetHex(tm.hex);
            setObjectCode(tm.objectCode);
        }
    });
    const onBlock = (event: Event) => {
        if (event.target instanceof HTMLInputElement) {
            const updated = event.target.valueAsNumber;
            SetBlock(updated);
            props.ctx.postMessage(new mess_trk.LoadBlock(updated, props.img_hash));
        }
    }
    const onDasm = (event: Event) => {
        if (event.target instanceof HTMLElement && objectCode) {
            PostOpenDasm(props.ctx, objectCode, event.target.textContent, props.img_hash);
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <span>Block</span> <input type="number" min=${props.stat.block_beg} max=${props.stat.block_end - 1} value=${block} onInput=${onBlock} ></input>
      <span style=${{ 'padding-left': '10px' }}>${DasmMenu({ name: "DASM", color_theme: props.color_theme, callback: onDasm })}</span>
      </div>
      <div>
      <pre>
      ${hex}
      </pre>
      </div>
    `;
}

