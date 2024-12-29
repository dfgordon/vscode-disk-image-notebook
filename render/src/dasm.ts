import type { RendererContext } from 'vscode-notebook-renderer';
import { useRef } from 'preact/hooks'
import { html } from 'htm/preact';
import { ThemeButtonProps, stdHeight } from './component.js';
import { ObjectCode, OpenDasm } from '../../messages/src/base.js';

export function PostOpenDasm(ctx: RendererContext<any>, objectCode: ObjectCode, proc: string, img_hash: string) {
    if (proc == "6502") {
        ctx.postMessage(new OpenDasm(objectCode, 0, "11", img_hash));
    } else if (proc == "65c02") {
        ctx.postMessage(new OpenDasm(objectCode, 1, "11", img_hash));
    } else if (proc == "65816 mx=00") {
        ctx.postMessage(new OpenDasm(objectCode, 2, "00", img_hash));
    } else if (proc == "65816 mx=01") {
        ctx.postMessage(new OpenDasm(objectCode, 2, "01", img_hash));
    } else if (proc == "65816 mx=10") {
        ctx.postMessage(new OpenDasm(objectCode, 2, "10", img_hash));
    } else if (proc == "65816 mx=11") {
        ctx.postMessage(new OpenDasm(objectCode, 2, "11", img_hash));
    }
}

export function DasmMenu(props: ThemeButtonProps) {
    function highlight(style: CSSStyleDeclaration) {
        style.backgroundColor = props.theme.radioOnBackground;
        style.color = props.theme.radioOnForeground;
    }
    function unhighlight(style: CSSStyleDeclaration) {
        style.backgroundColor = props.theme.radioOffBackground;
        style.color = props.theme.radioOffForeground;
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
        border: props.theme.buttonBorder,
        'background-color': props.theme.buttonBackground,
        color: props.theme.buttonForeground
    };
    const css_btn = {
        border: props.theme.buttonBorder,
        'background-color': props.theme.buttonBackground,
        color: props.theme.buttonForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        height: stdHeight,
        cursor: 'pointer'
    };
    const css_item = {
        border: props.theme.buttonBorder,
        'background-color': props.theme.radioDisabledBackground,
        color: props.theme.radioOffForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        height: stdHeight,
        cursor: 'pointer',
        overflow: 'auto',
        display: 'block',
        'white-space': 'nowrap'
    };
    return html`
    <div style=${css_dropdown} onMouseEnter=${showMenu} onMouseLeave=${hideMenu}>
        <button style=${css_btn}>${props.name}</a>
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
