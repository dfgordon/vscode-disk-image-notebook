import type { RendererContext } from 'vscode-notebook-renderer';
import { useState, useRef } from 'preact/hooks'
import { VNode } from 'preact';
import { html } from 'htm/preact';
import * as decode from './decode.js';
import * as interactive from '../../messages/src/base.js';
import * as xp from '../../messages/src/explore.js';
import * as theme from '../../messages/src/themes.js';

export type ExploreProps = {
    img_hash: string,
    ctx: RendererContext<any>,
    root_path: string,
    root_files: interactive.DirectoryRow[],
    start_path: string,
    start_files: interactive.DirectoryRow[],
    stat: interactive.Stat,
    color_theme: theme.ThemeColors
};

type UserSelectProps = {
    starting_user: string,
    users: string[],
    callback: (event: Event) => void
};

type ThemeButtonProps = {
    name: string,
    color_theme: theme.ThemeColors,
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

function DasmMenu(props: ThemeButtonProps) {
    function highlight(style: CSSStyleDeclaration) {
        style.backgroundColor = props.color_theme.radioOnBackground;
        style.color = props.color_theme.radioOnForeground;
    }
    function unhighlight(style: CSSStyleDeclaration) {
        style.backgroundColor = props.color_theme.radioOffBackground;
        style.color = props.color_theme.radioOffForeground;
    }
    // some better way?
    const menu0 = useRef(null);
    const highlight0 = () => highlight(menu0.current.style);
    const unhighlight0 = () => unhighlight(menu0.current.style);
    const menu1 = useRef(null);
    const highlight1 = () => highlight(menu1.current.style);
    const unhighlight1 = () => unhighlight(menu1.current.style);
    const menu2 = useRef(null);
    const highlight2 = () => highlight(menu2.current.style);
    const unhighlight2 = () => unhighlight(menu2.current.style);
    const menu3 = useRef(null);
    const highlight3 = () => highlight(menu3.current.style);
    const unhighlight3 = () => unhighlight(menu3.current.style);
    const menu4 = useRef(null);
    const highlight4 = () => highlight(menu4.current.style);
    const unhighlight4 = () => unhighlight(menu4.current.style);
    const menu5 = useRef(null);
    const highlight5 = () => highlight(menu5.current.style);
    const unhighlight5 = () => unhighlight(menu5.current.style);

    const dropdown = useRef(null);
    const showMenu = () => dropdown.current.style.display = "block";
    const hideMenu = () => dropdown.current.style.display = "none";
    const css_dropdown = {
        position: 'relative',
        display: 'inline-block'
    };
    const css_content = {
        display: 'none',
        position: 'absolute',
        overflow: 'auto',
        'z-index': 1,
        'text-decoration': 'none',
        border: props.color_theme.buttonBorder,
        'background-color': props.color_theme.buttonBackground,
        color: props.color_theme.buttonForeground
    };
    const css_btn = {
        border: props.color_theme.buttonBorder,
        'background-color': props.color_theme.buttonBackground,
        color: props.color_theme.buttonForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        cursor: 'pointer'
    };
    const css_item = {
        border: props.color_theme.buttonBorder,
        'background-color': props.color_theme.radioDisabledBackground,
        color: props.color_theme.radioOffForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        cursor: 'pointer',
        overflow: 'auto',
        display: 'block',
        'white-space': 'nowrap'
    };
    return html`
    <div style=${css_dropdown} onMouseEnter=${showMenu} onMouseLeave=${hideMenu}>
        <a href="#" style=${css_btn}>${props.name}</a>
        <div ref=${dropdown} style=${css_content}>
            <div><a href="#" ref=${menu0} style=${css_item} onMouseEnter=${highlight0} onMouseLeave=${unhighlight0} onClick=${props.callback}>6502</a></div>
            <div><a href="#" ref=${menu1} style=${css_item} onMouseEnter=${highlight1} onMouseLeave=${unhighlight1} onClick=${props.callback}>65c02</a></div>
            <div><a href="#" ref=${menu2} style=${css_item} onMouseEnter=${highlight2} onMouseLeave=${unhighlight2} onClick=${props.callback}>65816 mx=00</a></div>
            <div><a href="#" ref=${menu3} style=${css_item} onMouseEnter=${highlight3} onMouseLeave=${unhighlight3} onClick=${props.callback}>65816 mx=01</a></div>
            <div><a href="#" ref=${menu4} style=${css_item} onMouseEnter=${highlight4} onMouseLeave=${unhighlight4} onClick=${props.callback}>65816 mx=10</a></div>
            <div><a href="#" ref=${menu5} style=${css_item} onMouseEnter=${highlight5} onMouseLeave=${unhighlight5} onClick=${props.callback}>65816 mx=11</a></div>
        </div>
    </div>`;
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

function themeButton(props: ThemeButtonProps) {
    const css_btn = {
        border: props.color_theme.buttonBorder,
        'background-color': props.color_theme.buttonBackground,
        color: props.color_theme.buttonForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        cursor: 'pointer'
    };
    return html`<a href="#" style=${css_btn} onClick=${props.callback}>${props.name}</a>`
}

function textButton(props: ThemeButtonProps) {
    const css_btn = {
        border: 'none',
        background: 'none',
        color: props.color_theme.link,
        cursor: 'pointer'
    };
    return html`<button style=${css_btn} onClick=${props.callback}>${props.name}</button>`;
}

export function Explore(props: ExploreProps) {
    const [dir, setDir] = useState(true);
    const [rows, setRows] = useState(props.start_files);
    const [content, setContent] = useState("");
    const [objectCode, setObjectCode] = useState(null);
    const [typ, setTyp] = useState("");
    const [path, setPath] = useState(props.start_path);
    const [user, setUser] = useState(props.stat.users.length > 0 ? props.stat.users[0] : "0");
    props.ctx.onDidReceiveMessage(messg => {
        if (xp.ReturnedSubdirectory.test(messg) && messg.img_hash == props.img_hash) {
            const tm: xp.ReturnedSubdirectory = messg;
            setPath(tm.new_path);
            setRows(tm.rows);
            setDir(true);
        } else if (xp.ReturnedFile.test(messg) && messg.img_hash == props.img_hash) {
            const tm: xp.ReturnedFile = messg;
            setPath(tm.new_path);
            setContent(tm.content);
            setObjectCode(tm.objectCode);
            setTyp(tm.typ);
            setDir(false);
        }
    });
    const onSel = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            const newFile = event.target.textContent;
            if (props.stat.fs_name == "cpm" && path=="/") {
                setUser(newFile);
            }
            props.ctx.postMessage(new xp.ChangeDirectory(path, newFile, props.img_hash));
        }
    }
    const onBack = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            const match = path.match(/^\/([0-9]+)\/.+$/);
            if (props.stat.fs_name == "cpm" && match) {
                setUser(match[1]);
            }
            props.ctx.postMessage(new xp.ChangeDirectory(path, "..", props.img_hash));
        }
    }
    const onOpen = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            props.ctx.postMessage(new xp.OpenFile(content, props.stat.fs_name, typ, props.img_hash));
        }
    }
    const onDasm = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            if (event.target.textContent == "6502") {
                props.ctx.postMessage(new xp.OpenDasm(objectCode, 0, "11", props.img_hash));
            } else if (event.target.textContent == "65c02") {
                props.ctx.postMessage(new xp.OpenDasm(objectCode, 1, "11", props.img_hash));
            } else if (event.target.textContent == "65816 mx=00") {
                props.ctx.postMessage(new xp.OpenDasm(objectCode, 2, "00", props.img_hash));
            } else if (event.target.textContent == "65816 mx=01") {
                props.ctx.postMessage(new xp.OpenDasm(objectCode, 2, "01", props.img_hash));
            } else if (event.target.textContent == "65816 mx=10") {
                props.ctx.postMessage(new xp.OpenDasm(objectCode, 2, "10", props.img_hash));
            } else if (event.target.textContent == "65816 mx=11") {
                props.ctx.postMessage(new xp.OpenDasm(objectCode, 2, "11", props.img_hash));
            }
        }
    }
    const onUser = (event: Event) => {
        if (event.target instanceof HTMLSelectElement) {
            setUser(event.target.value);
            props.ctx.postMessage(new xp.ChangeDirectory("/", event.target.value, props.img_hash));
        }
    }

    if (!dir && objectCode && (props.stat.fs_name == "prodos" || props.stat.fs_name == "a2 dos")) {
        return html`
        <div style=${{ 'padding-top': '10px', clear: 'left' }}>
        ${themeButton({ name: "<", color_theme: props.color_theme, callback: onBack })}
        <span style=${{ 'padding-left': '10px', 'padding-right': '10px' }}>
            ${file_header(props.stat.fs_name, path)}
        </span>
        <span style=${{ 'padding-right': '10px' }}>
            ${themeButton({ name: "🗁", color_theme: props.color_theme, callback: onOpen })}
        </span>
        ${DasmMenu({ name: "DASM", color_theme: props.color_theme, callback: onDasm })}
        </div>
        <div>
        <pre>
        ${content}
        </pre>
        </div>
        `;
    }  else if (!dir) {
        return html`
        <div style=${{ 'padding-top': '10px', clear: 'left' }}>
        ${themeButton({ name: "<", color_theme: props.color_theme, callback: onBack })}
        <span style=${{ 'padding-left': '10px', 'padding-right': '10px' }}>${file_header(props.stat.fs_name, path)}</span>
        ${themeButton({ name: "🗁", color_theme: props.color_theme, callback: onOpen })}
        </div>
        <div>
        <pre>
        ${content}
        </pre>
        </div>
        `;
    } else {
        const root = path == props.root_path;
        const selectionProps: UserSelectProps = {
            users: props.stat.users,
            starting_user: user,
            callback: onUser

        }
        return html`
        <div style=${{ 'padding-top': '10px', clear: 'left' }}>
            ${root ? html`` : html`${themeButton({ name: "<", color_theme: props.color_theme, callback: onBack })}`}
            <span style=${root ? {} : { 'padding-left': '10px' }}>${dir_header(props.stat.fs_name, path, props.stat.label,selectionProps)}</span>
        </div>
        <div>
            ${rows.length > 0 ? html`
            <table>
            <tr>
                <th style=${{'text-align':'left'}}>${props.stat.fs_name=='cpm' && root ? 'Users' : 'File/Dir'}</th>
                ${Object.keys(rows[0].meta).map(item => { return html`<th>${item.replace('_',' ')}</th>` })}
            </tr>
            ${rows.map(row => {
                return html`<tr>
                    <td style=${{ 'text-align': 'left' }}>${textButton({ name: row.name, color_theme: props.color_theme, callback: onSel })}</td>
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
