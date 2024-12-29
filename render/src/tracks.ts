import type { RendererContext } from 'vscode-notebook-renderer';
import { Signal, useSignal, useComputed, useSignalEffect, batch, effect } from '@preact/signals';
import { html } from 'htm/preact';
import { VNode } from 'preact';
import * as mess_base from '../../messages/src/base.js';
import * as mess_trk from '../../messages/src/trk.js';
import * as mess_theme from '../../messages/src/themes.js';
import { IntRangeSelector, IntMapSelector, ThemeLabel, ThemeIntLabel } from './component.js';
import { DasmMenu, PostOpenDasm } from './dasm.js';

export function StartingAngle(chs_map: [[number, number, number, number]]): number {
    const min = Math.min(...chs_map.map((x) => x[2]));
    return chs_map.findIndex((x) => min == x[2]);
}

export type DisplaySectorProps = {
    img_hash: string,
    geometry: mess_base.Geometry,
    ctx: RendererContext<any>,
    startingDisplay: string,
    theme: mess_theme.ThemeColors
};

export type DisplayBlockProps = {
    img_hash: string,
    stat: mess_base.Stat,
    ctx: RendererContext<any>,
    startingDisplay: string,
    theme: mess_theme.ThemeColors
};

export type DisplayNibbleProps = {
    img_hash: string,
    geometry: mess_base.Geometry,
    ctx: RendererContext<any>,
    startingDisplay: string,
    theme: mess_theme.ThemeColors
};

class SectorIndicatorProps {
    selected: boolean;
    chs: [string, string, string];
    angle: number;
    theme: mess_theme.ThemeColors;
    callback: (angle: number) => void;
    constructor(sel: boolean, chs: [string,string,string], angle: number, col: mess_theme.ThemeColors, callback: (angle: number) => void) {
        this.selected = sel;
        this.chs = chs;
        this.angle = angle;
        this.theme = col;
        this.callback = callback;
    }
};

function SectorIndicator(props: SectorIndicatorProps): VNode {
    const css_item = {
        border: props.theme.buttonBorder,
        'background-color': props.selected ? props.theme.radioOnBackground : props.theme.radioOffBackground,
        color: props.selected ? props.theme.radioOnForeground : props.theme.radioOffForeground,
        'text-decoration': 'none',
        'font-family': 'monospace',
        padding: '2px 2px',
        cursor: 'pointer',
        overflow: 'auto',
        display: 'block',
        'white-space': 'nowrap'
    };
    function select(event: Event) {
        props.callback(props.angle);
    }
    return html`
            <div style=${css_item} onClick=${select}> ${props.chs[0]} </div>
            <div style=${css_item} onClick=${select}> ${props.chs[1]} </div>
            <div style=${css_item} onClick=${select}> ${props.chs[2]} </div>
        `;
}

class SectorLegendProps {
    selected: boolean;
    chs: [string, string, string];
    theme: mess_theme.ThemeColors;
    constructor(sel: boolean, chs: [string,string,string], col: mess_theme.ThemeColors) {
        this.selected = sel;
        this.chs = chs;
        this.theme = col;
    }
};

function SectorLegend(props: SectorLegendProps): VNode {
    const css_item = {
        border: props.theme.buttonBorder,
        'background-color': props.selected ? props.theme.radioOffBackground : props.theme.radioDisabledBackground,
        color: props.selected ? props.theme.radioOffForeground : props.theme.radioDisabledForeground,
        'text-decoration': 'none',
        'font-family': 'monospace',
        padding: '2px 2px',
        overflow: 'auto',
        display: 'block',
        'white-space': 'nowrap'
    };
    return html`
            <div style=${css_item}> ${props.chs[0]} </div>
            <div style=${css_item}> ${props.chs[1]} </div>
            <div style=${css_item}> ${props.chs[2]} </div>
        `;
}

function sfmt(num: number): string {
    return num.toString(16).toUpperCase().padStart(2, "0");
}
function TrackSummary(rzq: [number, number, number], track: mess_base.Track, theme: mess_theme.ThemeColors, callback: (angle: number) => void): VNode {
    const props_rzq: SectorLegendProps = new SectorLegendProps(true, [sfmt(rzq[0]), sfmt(rzq[1]), sfmt(rzq[2])], theme);
    const props_list: SectorIndicatorProps[] = track.chs_map.map((x,i) => new SectorIndicatorProps(i==rzq[2], [sfmt(x[0]), sfmt(x[1]), sfmt(x[2])], i, theme, callback));
    return html`
        <table>
            <tr>
                <td style=${{ 'padding': '1px 10px' }}>${SectorLegend(new SectorLegendProps(false, ["R", "Z", "θ"], theme))}</td>
                <td style=${{'padding': '1px 2px'}}>${SectorLegend(props_rzq)}</td>
                <td style=${{'padding': '1px 10px'}}>${SectorLegend(new SectorLegendProps(false,["C","H","S"],theme))}</td>
                ${props_list.map(p => html`<td style=${{'padding': '1px 2px'}}>${SectorIndicator(p)}</td>`)}
            </tr>
        </table>
    `;
}

export function DisplayNibbles(props: DisplayNibbleProps): VNode {
    //console.log("enter nibble renderer");
    const trk = useSignal(0);
    const hex = useSignal(props.startingDisplay);
    const ch = useComputed(() => {
        return [
            props.geometry.tracks[trk.value].cylinder,
            props.geometry.tracks[trk.value].head
        ];
    });
    useSignalEffect(() => {
        if (typeof ch.value[0] === 'number' && typeof ch.value[1] === 'number') {
            props.ctx.postMessage(new mess_trk.LoadNibbles(ch.value[0], ch.value[1], props.img_hash));
        }
    });
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedNibbles.test(messg) && messg.img_hash == props.img_hash) {
            hex.value = messg.hex;
        }
    });
    const onTrk = (ival: number) => {
        if (ival >= props.geometry.tracks.length) {
            trk.value = 0;
        } else {
            trk.value = ival;
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      ${IntRangeSelector({name: "Track", validRange: [0, props.geometry.tracks.length], theme: props.theme, callback: onTrk})}
      </div>
      <div>
      <pre>
      ${hex.value}
      </pre>
      </div>
    `;
}

export function DisplaySector(props: DisplaySectorProps): VNode {
    //console.log("enter sector renderer");
    const trk = useSignal(0);
    const angle = useSignal(StartingAngle(props.geometry.tracks[0].chs_map));
    const hex = useSignal(props.startingDisplay);
    const objectCode = useSignal(null);
    const rzq_chs: Signal<[[number, number, number], [number, number, number]]> = useComputed(() => {
        const m = props.geometry.tracks[trk.value].chs_map;
        const r = props.geometry.tracks[trk.value].cylinder;
        const z = props.geometry.tracks[trk.value].head;
        const q = angle.value;
        return [
            [r, z, q],
            [m[q][0], m[q][1], m[q][2]]
        ];
    });
    const validList: Signal<number[]> = useComputed(() => {
        return props.geometry.tracks[trk.value].chs_map.map((x) => x[2]);
    })
    // it appears component version of `effect` needs no explicit disposal
    useSignalEffect(() => {
        props.ctx.postMessage(new mess_trk.LoadSector(trk.value, angle.value, props.img_hash));
    });
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedSector.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_trk.ReturnedSector = messg;
            batch(() => {
                hex.value = tm.hex;
                objectCode.value = tm.objectCode;
            });
        }
    });
    const onTrk = (ival: number) => {
        const vlist = props.geometry.tracks[ival].chs_map.map((x) => x[2]);
        let q = angle.value;
        const sec = rzq_chs.value[1][2];
        if (vlist.includes(sec) && ival != trk.value) {
            q = vlist.findIndex((x) => x == sec);
        }
        batch(() => {
            angle.value = q;
            trk.value = ival;
        })
    }
    const onAngle = (q: number) => {
        angle.value = q;
    }
    const onDasm = (event: Event) => {
        if (event.target instanceof HTMLElement && objectCode.value) {
            PostOpenDasm(props.ctx, objectCode.value, event.target.textContent, props.img_hash);
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <table>
        <tr>
          <td>${IntRangeSelector({ name: "Track", validRange: [0, props.geometry.tracks.length], theme: props.theme, callback: onTrk })}</td>
          <td>${IntMapSelector({ name: "Sector", ikey: angle, validList: validList, theme: props.theme })}</td>
          <td>${DasmMenu({ name: "DASM", theme: props.theme, callback: onDasm })}</td>
        </tr>
      </table>
      </div>
      ${TrackSummary(rzq_chs.value[0], props.geometry.tracks[trk.value], props.theme, onAngle)}
      <div>
      <pre>
      ${hex.value}
      </pre>
      </div>
      <div>
      <table>
        <tr>
          <td>${ThemeLabel({ name: "Track Count", theme: props.theme })}
            ${ThemeIntLabel({ name: props.geometry.tracks.length.toString(), theme: props.theme })}</td>
          <td>${ThemeLabel({ name: "Sector Count", theme: props.theme })}
            ${ThemeIntLabel({ name: validList.value.length.toString(), theme: props.theme })}</td>
        </tr>
      </table>
      </div>
    `;
}

export function DisplayBlock(props: DisplayBlockProps): VNode {
    //console.log("enter block renderer");
    const block = useSignal(props.stat.block_beg);
    const hex = useSignal(props.startingDisplay);
    const objectCode = useSignal(null);
    // TODO: handle the returned dispose function
    useSignalEffect(() => {
        props.ctx.postMessage(new mess_trk.LoadBlock(block.value, props.img_hash));
    });
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedBlock.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_trk.ReturnedBlock = messg;
            batch(() => {
                hex.value = tm.hex;
                objectCode.value = tm.objectCode;
            })
        }
    });
    const onBlock = (ival: number) => {
        block.value = ival;
    }
    const onDasm = (event: Event) => {
        if (event.target instanceof HTMLElement && objectCode.value) {
            PostOpenDasm(props.ctx, objectCode.value, event.target.textContent, props.img_hash);
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      ${IntRangeSelector({name: "Block", validRange: [props.stat.block_beg, props.stat.block_end], theme: props.theme, callback: onBlock})}
      <span style=${{ 'padding-left': '10px' }}>${DasmMenu({ name: "DASM", theme: props.theme, callback: onDasm })}</span>
      </div>
      <div>
      <pre>
      ${hex.value}
      </pre>
      </div>
      <div>
      <table>
        <tr>
          <td>${ThemeLabel({ name: "First", theme: props.theme })}
            ${ThemeIntLabel({ name: props.stat.block_beg.toString(), theme: props.theme })}</td>
          <td>${ThemeLabel({ name: "Last", theme: props.theme })}
            ${ThemeIntLabel({ name: (props.stat.block_end-1).toString(), theme: props.theme })}</td>
        </tr>
      </table>
      </div>
    `;
}

