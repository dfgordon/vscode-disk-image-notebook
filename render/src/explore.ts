import type { RendererContext } from 'vscode-notebook-renderer';
import { useSignal, batch } from '@preact/signals'
import { VNode } from 'preact';
import { html } from 'htm/preact';
import * as decode from './decode.js';
import * as mess_base from '../../messages/src/base.js';
import * as mess_xp from '../../messages/src/explore.js';
import * as mess_theme from '../../messages/src/themes.js';
import { ThemeButtonProps, ThemeButton } from './component.js';
import { DasmMenu, PostOpenDasm } from './dasm.js';

export type ExploreProps = {
    img_hash: string,
    ctx: RendererContext<any>,
    root_path: string,
    root_files: mess_base.DirectoryRow[],
    start_path: string,
    start_files: mess_base.DirectoryRow[],
    stat: mess_base.Stat,
    theme: mess_theme.ThemeColors
};

type UserSelectProps = {
    starting_user: string,
    users: string[],
    callback: (event: Event) => void
};

function dir_header(fs: string,path: string,label: string,userProps: UserSelectProps): VNode {
    if (fs == 'a2 dos') {
        return html`Apple DOS Volume ${label}`;
    } else if (fs == 'prodos') {
        return html`ProDOS current path ${path}`;
    } else if (fs == 'cpm') {
        if (path == "/") {
            return html`CP/M User Directory`;
        }
        return html`${user_selection(userProps)}`;
    } else if (fs == 'a2 pascal') {
        return html`Pascal Volume ${label}`;
    } else if (fs == 'fat') {
        return html` MS-DOS/FAT current path ${path}`;
    }
}

function dir_footer(fs: string,free: number,label: string): VNode {
    if (fs == 'a2 dos') {
        return html`${free} free sectors`;
    } else if (fs == 'prodos') {
        return html`${free} free blocks`;
    } else if (fs == 'cpm') {
        return html`
            <div>
                ${free} free blocks
            </div>
            <div>
                ${label == "" ? "Disk has no label" : "Disk label is " + label}
            </div>`;
    } else if (fs == 'a2 pascal') {
        return html`${free} free blocks`;
    } else if (fs == 'fat') {
        return html`
            <div>
                ${free} free blocks
            </div>
            <div>
                ${label == "" || label == "NO NAME" ? "Disk has no label" : "Disk label is " + label}
            </div>`;
    }
}

function file_header(fs: string,path: string): VNode {
    if (fs == 'a2 dos') {
        return html`Apple DOS File ${path}`;
    } else if (fs == 'prodos') {
        return html`ProDOS File ${path}`;
    } else if (fs == 'cpm') {
        return html`CP/M File ${path}`;
    } else if (fs == 'a2 pascal') {
        return html`Pascal File ${path}`;
    } else if (fs == 'fat') {
        return html`MS-DOS/FAT File ${path}`;
    }
}

function user_selection(props: UserSelectProps) {
    const onChange = (event: Event) => {
        if (event.target instanceof HTMLSelectElement) {
            props.callback(event);
        }
    }
    return html`
    <select value=${props.starting_user} onChange=${onChange}>
        ${props.users.map((v: string) => { return html`<option value=${v}>${"user "+v}</option>` })}
    </select>`
}

function textButton(props: ThemeButtonProps) {
    const css_btn = {
        border: 'none',
        background: 'none',
        color: props.theme.link,
        cursor: 'pointer'
    };
    return html`<button style=${css_btn} onClick=${props.callback}>${props.name}</button>`;
}

export function Explore(props: ExploreProps) {
    const path = useSignal(props.start_path);
    const isDir = useSignal(true);
    const typ = useSignal("");
    const user = useSignal(props.stat.users.length > 0 ? props.stat.users[0] : "0");
    const rows = useSignal(props.start_files);
    const content = useSignal("");
    const objectCode = useSignal(null);
    props.ctx.onDidReceiveMessage(messg => {
        if (mess_xp.ReturnedSubdirectory.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_xp.ReturnedSubdirectory = messg;
            batch(() => {
                path.value = tm.new_path;
                rows.value = tm.rows;
                isDir.value = true;
            });
        } else if (mess_xp.ReturnedFile.test(messg) && messg.img_hash == props.img_hash) {
            const tm: mess_xp.ReturnedFile = messg;
            batch(() => {
                path.value = tm.new_path;
                content.value = tm.content;
                objectCode.value = tm.objectCode;
                typ.value = tm.typ;
                isDir.value = false;
            });
        }
    });
    const onSel = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            const newFile = event.target.textContent;
            if (props.stat.fs_name == "cpm" && path.value=="/") {
                user.value = newFile;
            }
            props.ctx.postMessage(new mess_xp.ChangeDirectory(path.value, newFile, props.img_hash));
        }
    }
    const onBack = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            const match = path.value.match(/^\/([0-9]+)\/.+$/);
            if (props.stat.fs_name == "cpm" && match) {
                user.value = match[1];
            }
            props.ctx.postMessage(new mess_xp.ChangeDirectory(path.value, "..", props.img_hash));
        }
    }
    const onOpen = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            props.ctx.postMessage(new mess_xp.OpenFile(content.value, props.stat.fs_name, typ.value, props.img_hash));
        }
    }
    const onDasm = (event: Event) => {
        if (event.target instanceof HTMLElement && objectCode) {
            PostOpenDasm(props.ctx, objectCode.value, event.target.textContent, props.img_hash);
        }
    }
    const onUser = (event: Event) => {
        if (event.target instanceof HTMLSelectElement) {
            user.value = event.target.value;
            props.ctx.postMessage(new mess_xp.ChangeDirectory("/", event.target.value, props.img_hash));
        }
    }

    if (!isDir.value && objectCode.value && (props.stat.fs_name == "prodos" || props.stat.fs_name == "a2 dos")) {
        return html`
        <div style=${{ 'padding-top': '10px', clear: 'left' }}>
        ${ThemeButton({ name: "<", theme: props.theme, callback: onBack })}
        <span style=${{ 'padding-left': '10px', 'padding-right': '10px' }}>
            ${file_header(props.stat.fs_name, path.value)}
        </span>
        <span style=${{ 'padding-right': '10px' }}>
            ${ThemeButton({ name: "\u{1f4c2}", theme: props.theme, callback: onOpen })}
        </span>
        ${DasmMenu({ name: "DASM", theme: props.theme, callback: onDasm })}
        </div>
        <div>
        <pre>
        ${content.value}
        </pre>
        </div>
        `;
    }  else if (!isDir.value) {
        return html`
        <div style=${{ 'padding-top': '10px', clear: 'left' }}>
        ${ThemeButton({ name: "<", theme: props.theme, callback: onBack })}
        <span style=${{ 'padding-left': '10px', 'padding-right': '10px' }}>${file_header(props.stat.fs_name, path.value)}</span>
        ${ThemeButton({ name: "\u{1f4c2}", theme: props.theme, callback: onOpen })}
        </div>
        <div>
        <pre>
        ${content.value}
        </pre>
        </div>
        `;
    } else {
        const root = path.value == props.root_path;
        const selectionProps: UserSelectProps = {
            users: props.stat.users,
            starting_user: user.value,
            callback: onUser

        }
        return html`
        <div style=${{ 'padding-top': '10px', clear: 'left' }}>
            ${root ? html`` : html`${ThemeButton({ name: "<", theme: props.theme, callback: onBack })}`}
            <span style=${root ? {} : { 'padding-left': '10px' }}>${dir_header(props.stat.fs_name, path.value, props.stat.label,selectionProps)}</span>
        </div>
        <div>
            ${rows.value.length > 0 ? html`
            <table>
            <tr>
                <th style=${{'text-align':'left'}}>${props.stat.fs_name=='cpm' && root ? 'Users' : 'File/Dir'}</th>
                ${Object.keys(rows.value[0].meta).map(item => { return html`<th>${item.replace('_',' ')}</th>` })}
            </tr>
            ${rows.value.map(row => {
                return html`<tr>
                    <td style=${{ 'text-align': 'left' }}>${textButton({ name: row.name, theme: props.theme, callback: onSel })}</td>
                    ${Object.entries(row.meta).map(([key, item]) => {
                        return key=='type' ? html`<td>${decode.prettyType(item.toString(),props.stat.fs_name)}</td>` : html`<td>${item.toString()}</td>`
                    })}
                </tr>`
            })}
            </table>` : html`No Files`}
        </div>
        <div style=${{ 'padding-top': '10px' }}>
            ${dir_footer(props.stat.fs_name, props.stat.free_blocks, props.stat.label)}
        </div>
        `;
    }
}
