import type { RendererContext } from 'vscode-notebook-renderer';
import { Signal, useSignal, useComputed, useSignalEffect, batch, effect } from '@preact/signals';
import { html } from 'htm/preact';
import { VNode } from 'preact';
import * as mess_base from '../../messages/src/base.js';
import * as mess_trk from '../../messages/src/trk.js';
import * as mess_theme from '../../messages/src/themes.js';
import { IntRangeSelector, IntMapSelector, ThemeRadio, ThemeLabel, ThemeIndicator, MotorRangeSelector } from './component.js';
import { DasmMenu, PostOpenDasm } from './dasm.js';

export function StartingAngle(tracks: mess_base.Track[]): number {
    let min = 0xffff;
    let ans = 0;
    for (const trk of tracks) {
        if (typeof trk.solution == 'object') {
            let sec_pos = trk.solution.addr_type.indexOf("S");
            for (var i = 0; i < trk.solution.addr_map.length; i++) {
                const sec = parseInt(trk.solution.addr_map[i].substring(sec_pos, sec_pos+2), 16);
                if (sec < min) {
                    min = sec;
                    ans = i;
                }
            }
        }
    }
    return ans;
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
function sec_instance(addr: string): [string,string,string] {
    return [addr.substring(0, 2), addr.substring(2, 4), addr.substring(4, 6)];
}
function legend(addr_type: string): [string,string,string] {
    return [addr_type[0], addr_type[1], addr_type[2]];
}
function TrackSummary(rzq: [number, number, number], track: mess_base.Track, theme: mess_theme.ThemeColors, callback: (angle: number) => void): VNode {
    const props_rzq: SectorLegendProps = new SectorLegendProps(true, [sfmt(rzq[0]), sfmt(rzq[1]), sfmt(rzq[2])], theme);
    if (typeof track.solution == 'string') {
        return html``
    }
    let sol = track.solution;
    const props_list: SectorIndicatorProps[] = sol.addr_map.map((x,i) => new SectorIndicatorProps(i==rzq[2], sec_instance(x), i, theme, callback));
    return html`
        <table>
            <tr>
                <td style=${{ 'padding': '1px 10px' }}>${SectorLegend(new SectorLegendProps(false, ["R", "Z", "θ"], theme))}</td>
                <td style=${{'padding': '1px 2px'}}>${SectorLegend(props_rzq)}</td>
                <td style=${{'padding': '1px 10px'}}>${SectorLegend(new SectorLegendProps(false,legend(sol.addr_type),theme))}</td>
                ${props_list.map(p => html`<td style=${{'padding': '1px 2px'}}>${SectorIndicator(p)}</td>`)}
            </tr>
        </table>
    `;
}

export function DisplayNibbles(props: DisplayNibbleProps): VNode {
    //console.log("enter nibble renderer");
    const trk = useSignal([0,0]);
    const hex = useSignal(props.startingDisplay);
    const method = useSignal("auto");
    const ch = useComputed(() => {
        // WOZ is the only case where fractional tracks come in, if another
        // ever does revisit this
        return [
            props.geometry.tracks[trk.value[0]].cylinder + trk.value[1] / props.geometry.summary.steps_per_cyl,
            props.geometry.tracks[trk.value[0]].head
        ];
    });
    const end_trk = useComputed(() => {
        const summary = props.geometry.summary;
        if (summary.last_solved_track + 1 > summary.cylinders) {
            return summary.last_solved_track + 1;
        } else {
            return summary.cylinders;
        }
    })
    useSignalEffect(() => {
        if (typeof ch.value[0] === 'number' && typeof ch.value[1] === 'number' && typeof method.value === 'string') {
            props.ctx.postMessage(new mess_trk.LoadNibbles(ch.value[0], ch.value[1], props.img_hash));
        }
    });
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedNibbles.test(messg) && messg.img_hash == props.img_hash) {
            hex.value = messg.hex;
        } else if (mess_base.MethodChanged.test(messg) && messg.img_hash == props.img_hash) {
            method.value = messg.content;
        }
    });
    const onTrk = (coarse: number,fine: number) => {
        if (coarse >= props.geometry.tracks.length) {
            trk.value = [0,0];
        } else {
            trk.value = [coarse,fine];
        }
    }
    if (end_trk.value == 0) {
        return html`
            <div style=${{ 'padding-top': '10px', clear: 'left' }}>
            NO TRACKS
            </div>
        `;
    }
    const unsolved_indicator = (props: number) => {
        if (props > 0) {
            return html`
                <div>
                There are ${props} unsolved tracks.
                </div>
            `;
        } else {
            return html``;
        }
    }
    return html`
      <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      <table>
        <tr>
          <td>${MotorRangeSelector({
            name: "Track", coarseRange: [0, end_trk.value],
            fineRange: props.geometry.summary.steps_per_cyl > 1 ? [0, props.geometry.summary.steps_per_cyl] : null,
            theme: props.theme, callback: onTrk})}
          </td>
          <td>${ThemeLabel({ name: "Cylinder", theme: props.theme })}
            ${ThemeIndicator({ name: ch.value[0].toString(), maxChars: props.geometry.summary.steps_per_cyl > 1 ? 4 : 2, theme: props.theme })}
          </td>
          <td>${ThemeLabel({ name: "Head", theme: props.theme })}
            ${ThemeIndicator({ name: ch.value[1].toString(), maxChars: 1, theme: props.theme })}
          </td>
        </tr>
      </table>
      </div>
      ${unsolved_indicator(props.geometry.summary.unsolved_tracks)}
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
    const angle = useSignal(StartingAngle(props.geometry.tracks));
    const hex = useSignal(props.startingDisplay);
    const objectCode = useSignal(null);
    const method = useSignal("auto");
    const rzq_addr: Signal<[[number, number, number], [number, number, number] | null]> = useComputed(() => {
        const trk_obj = props.geometry.tracks[trk.value];
        const r = trk_obj.cylinder;
        const z = trk_obj.head;
        let q = angle.value;
        let addr = null;
        if (typeof trk_obj.solution == 'object') {
            const m = trk_obj.solution.addr_map;
            if (q >= m.length && m.length > 0) {
                q = m.length - 1;
            }
            if (q < 0) {
                q = 0;
            }
            if (m.length > 0 && q != null) {
                const a1 = parseInt(m[q].substring(0, 2), 16);
                const a2 = parseInt(m[q].substring(2, 4), 16);
                const a3 = parseInt(m[q].substring(4, 6), 16);
                addr = [a1, a2, a3];
            }
        }
        return [
            [r, z, q],
            addr
        ];
    });
    const validList: Signal<number[]> = useComputed(() => {
        const sol = props.geometry.tracks[trk.value].solution;
        if (typeof sol == 'object') {
            const beg = sol.addr_type == "CSHFK" ? 2 : 4;
            return sol.addr_map.map((x) => parseInt(x.substring(beg, beg + 2), 16));
        } else {
            return [];
        }
    })
    // it appears component version of `effect` needs no explicit disposal
    useSignalEffect(() => {
        if (typeof method.value === 'string') {
            props.ctx.postMessage(new mess_trk.LoadSector(trk.value, angle.value, props.img_hash));
        }
    });
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedSector.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_trk.ReturnedSector = messg;
            batch(() => {
                hex.value = tm.hex;
                objectCode.value = tm.objectCode;
            });
        } else if (mess_base.MethodChanged.test(messg) && messg.img_hash == props.img_hash) {
            method.value = messg.content;
        }
    });
    const onTrk = (ival: number) => {
        const sol = props.geometry.tracks[trk.value].solution;
        if (typeof sol == 'object') {
            const beg = sol.addr_type == "CSHFK" ? 2 : 4;
            const vlist = sol.addr_map.map((x) => parseInt(x.substring(beg,beg+2),16));
            let q = angle.value;
            const sec = rzq_addr.value[1][beg/2];
            if (vlist.includes(sec) && ival != trk.value) {
                q = vlist.findIndex((x) => x == sec);
            } else if (ival != trk.value) {
                // sector has disappeared, stay at this angle, or else take the last angle
                if (q >= vlist.length) {
                    q = vlist.length - 1;
                }
            }
            batch(() => {
                angle.value = q;
                trk.value = ival;
            })
        } else {
            trk.value = ival;
        }
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
          <td>${IntRangeSelector({ name: "Track", validRange: [0, props.geometry.summary.last_solved_track+1], theme: props.theme, callback: onTrk })}</td>
          <td>${IntMapSelector({ name: "Sector", ikey: angle, validList: validList, theme: props.theme })}</td>
          <td>${DasmMenu({ name: "DASM", theme: props.theme, callback: onDasm })}</td>
        </tr>
      </table>
      </div>
      ${TrackSummary(rzq_addr.value[0], props.geometry.tracks[trk.value], props.theme, onAngle)}
      <div>
      <pre>
      ${hex.value}
      </pre>
      </div>
      <div>
      <table>
        <tr>
          <td>${ThemeLabel({ name: "Solved Tracks", theme: props.theme })}
            ${ThemeIndicator({ name: props.geometry.summary.solved_tracks.toString(), maxChars: 0, theme: props.theme })}</td>
          <td>${ThemeLabel({ name: "Sector Count", theme: props.theme })}
            ${ThemeIndicator({ name: validList.value.length.toString(), maxChars: 0, theme: props.theme })}</td>
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
    const method = useSignal("auto");
    // TODO: handle the returned dispose function
    useSignalEffect(() => {
        if (typeof method.value === 'string') {
            props.ctx.postMessage(new mess_trk.LoadBlock(block.value, props.img_hash));
        }
    });
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_trk.ReturnedBlock.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_trk.ReturnedBlock = messg;
            batch(() => {
                hex.value = tm.hex;
                objectCode.value = tm.objectCode;
            })
        } else if (mess_base.MethodChanged.test(messg) && messg.img_hash == props.img_hash) {
            method.value = messg.content;
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
            ${ThemeIndicator({ name: props.stat.block_beg.toString(), maxChars: 0, theme: props.theme })}</td>
          <td>${ThemeLabel({ name: "Last", theme: props.theme })}
            ${ThemeIndicator({ name: (props.stat.block_end-1).toString(), maxChars: 0, theme: props.theme })}</td>
        </tr>
      </table>
      </div>
    `;
}
