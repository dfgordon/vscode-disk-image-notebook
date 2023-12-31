import type { RendererContext } from 'vscode-notebook-renderer';
import { useState } from 'preact/hooks'
import { html } from 'htm/preact';
import * as base from '../../messages/src/base.js';
import * as trk_mess from '../../messages/src/trk.js';

export function StartingSector(chs_map: [[number,number,number]]): number {
    let sec = chs_map[0][2];
    for (const chs of chs_map) {
        if (chs[2] < sec)
            sec = chs[2]
    }
    return sec;
}

export type DisplaySectorProps = {
    img_hash: string,
    geometry: base.Geometry,
    ctx: RendererContext<any>,
    startingDisplay: string,
};

export type DisplayBlockProps = {
    img_hash: string,
    stat: base.Stat,
    ctx: RendererContext<any>,
    startingDisplay: string
};

export type DisplayNibbleProps = {
    img_hash: string,
    geometry: base.Geometry,
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
        if (trk_mess.ReturnedNibbles.test(messg) && messg.img_hash == props.img_hash) {
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
            props.ctx.postMessage(new trk_mess.LoadNibbles(updatedCyl, updatedHead, props.img_hash));
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
    props.ctx.onDidReceiveMessage(messg => {
        if (trk_mess.ReturnedSector.test(messg) && messg.img_hash == props.img_hash) {
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
            props.ctx.postMessage(new trk_mess.LoadSector(updatedCyl, updatedHead, sec, props.img_hash));
        }
    }
    const onSec = (event: Event) => {
        if (event.target instanceof HTMLInputElement) {
            const updated = event.target.valueAsNumber;
            SetSec(updated);
            props.ctx.postMessage(new trk_mess.LoadSector(cyl, head, updated, props.img_hash));
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <table>
        <tr>
          <td>Track</td><td><input type="number" min=0 max=${props.geometry.tracks.length - 1} value=${trk} onInput=${onTrk} ></input></td>
          <td>Sector</td><td><input type="number" min=0 max=100 value=${sec} onInput=${onSec}></input></td>
          <td>(CHS ${cyl},${head},${sec})</td>
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
    props.ctx.onDidReceiveMessage(messg => {
        if (trk_mess.ReturnedBlock.test(messg) && messg.img_hash == props.img_hash) {
            SetHex(messg.hex);
        }
    });
    const onBlock = (event: Event) => {
        if (event.target instanceof HTMLInputElement) {
            const updated = event.target.valueAsNumber;
            SetBlock(updated);
            props.ctx.postMessage(new trk_mess.LoadBlock(updated, props.img_hash));
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <span>Block</span> <input type="number" min=${props.stat.block_beg} max=${props.stat.block_end - 1} value=${block} onInput=${onBlock} ></input>
      </div>
      <div>
      <pre>
      ${hex}
      </pre>
      </div>
    `;
}

