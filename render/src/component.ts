import { html } from 'htm/preact';
import * as theme from '../../messages/src/themes.js';
import { batch, Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals';

export const stdHeight = '28px';

var counter: NodeJS.Timeout;
var buttonPressUpdated: boolean;

function constrainWithList(validList: number[], val: number): number | null {
    if (validList.length == 0) {
        return null;
    }
    if (isNaN(val)) {
        return validList[0];
    } else if (!validList.includes(val)) {
        // if not within hull take min
        if (val < Math.min(...validList) || val > Math.max(...validList)) {
            return Math.min(...validList);
        }
        // otherwise take nearest
        let antimerit = null;
        let ans = null;
        for (let x of validList) {
            const tst = Math.abs(x - val);
            if (ans == null || tst < antimerit) {
                ans = x;
                antimerit = tst;
            }
        }
        return ans;
    } else {
        return null;
    }
}

function constrainWithRange(validRange: [number, number], val: number): number | null {
    if (isNaN(val)) {
        return validRange[0];
    } else if (val < validRange[0]) {
        return validRange[0];
    } else if (val >= validRange[1]) {
        return validRange[1] - 1;
    } else {
        return null;
    }
}

export type ThemeButtonProps = {
    name: string,
    theme: theme.ThemeColors,
    callback: (event: Event) => void
};

export type ThemeRadioProps = {
    name: string,
    state: string, // 'on', 'off', 'disabled'
    theme: theme.ThemeColors,
    callback: (event: Event) => void
};

export type MultiStateButtonProps = {
    numStates: number,
    states: string[],
    theme: theme.ThemeColors,
    callback: (state: number) => void
};

export function ThemeRadio(props: ThemeRadioProps) {
    const css = {};
    if (props.state == 'on') {
        css['width'] = '100px';
        css['height'] = '24px';
        css['border'] = props.theme.radioOnBorder;
        css['background-color'] = props.theme.radioOnBackground;
        css['color'] = props.theme.radioOnForeground;
        css['float'] = 'left';
        css['cursor'] = 'pointer';
    } else if (props.state == 'off') {
        css['width'] = '100px';
        css['height'] = '24px';
        css['border'] = props.theme.radioOffBorder;
        css['background-color'] = props.theme.radioOffBackground;
        css['color'] = props.theme.radioOffForeground;
        css['float'] = 'left';
        css['cursor'] = 'pointer';
    } else {
        css['width'] = '100px';
        css['height'] = '24px';
        css['border'] = props.theme.radioDisabledBorder;
        css['background-color'] = props.theme.radioDisabledBackground;
        css['color'] = props.theme.radioDisabledForeground;
        css['float'] = 'left';
    }
    function click(event: Event) {
        if (props.state == 'off') {
            props.callback(event);
        }
    }
    return html`<button style=${css} onClick=${click}>${props.name}</a>`;
}

export function ThemeButton(props: ThemeButtonProps) {
    const css = {
        border: props.theme.buttonBorder,
        'background-color': props.theme.buttonBackground,
        color: props.theme.buttonForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        height: stdHeight,
        'box-sizing': 'border-box',
        cursor: 'pointer'
    };
    return html`<button style=${css} onClick=${props.callback}>${props.name}</a>`;
}

export function MultiStateButton(props: MultiStateButtonProps) {
    const state = useSignal(0);
    const css = {
        border: props.theme.buttonBorder,
        'background-color': props.theme.buttonBackground,
        color: props.theme.buttonForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        width: '30px',
        height: stdHeight,
        'box-sizing': 'border-box',
        cursor: 'pointer'
    };
    function next(event: Event) {
        if (state.value + 1 == props.numStates) {
            state.value = 0;
        } else {
            state.value += 1;
        }
        props.callback(state.value);
    }
    return html`<button style=${css} onClick=${next}>${props.states[state.value]}</a>`;
}

export function ThemeRepButton(props: ThemeButtonProps) {
    const css = {
        border: props.theme.buttonBorder,
        'background-color': props.theme.buttonBackground,
        color: props.theme.buttonForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        height: stdHeight,
        'box-sizing': 'border-box',
        cursor: 'pointer'
    };
    function start(event: Event) {
        buttonPressUpdated = false;
        counter = setInterval(() => {
            props.callback(event);
            buttonPressUpdated = true;
        }, 100);
    }
    function end(event: Event) {
        if (!buttonPressUpdated) {
            props.callback(event);
        }
        buttonPressUpdated = false;
        clearInterval(counter)
    }
    return html`<button style=${css} onMouseDown=${start} onMouseUp=${end}>${props.name}</a>`;
}

export type ThemeLabelProps = {
    name: string,
    theme: theme.ThemeColors
}

export function ThemeLabel(props: ThemeLabelProps) {
    const css = {
        border: props.theme.radioOffBorder,
        'background-color': props.theme.radioOffBackground,
        color: props.theme.radioOffForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        height: stdHeight,
        'box-sizing': 'border-box'
    };
    return html`<button style=${css}>${props.name}</label>`;
}

export type ThemeindicatorProps = {
    name: string,
    theme: theme.ThemeColors,
    maxChars: number // if 0 fit text to box
}

export function ThemeIndicator(props: ThemeindicatorProps) {
    const css = {
        border: props.theme.radioOffBorder,
        'background-color': props.theme.radioOffBackground,
        color: props.theme.radioOffForeground,
        'text-decoration': 'none',
        padding: '2px 8px',
        'font-size': '17px',
        width: props.maxChars==0 ? 'none' : (20+props.maxChars*10).toString()+'px',
        height: stdHeight,
        'box-sizing': 'border-box',
        'text-align': 'end',
        'vertical-align': 'bottom'
    };
    return html`<button style=${css}>${props.name}</label>`;
}

export type ThemeIntProps = {
    name: string,
    min: number,
    max: number,
    theme: theme.ThemeColors,
    callback: (event: Event) => void
}

export function ThemeInt(props: ThemeIntProps) {
    const maxAbs = Math.max(Math.abs(props.min), Math.abs(props.max));
    const maxDigits = Math.max(2,Math.floor(Math.log10(maxAbs) + 1));
    const css = {
        border: props.theme.radioOffBorder,
        'background-color': props.theme.radioOffBackground,
        color: props.theme.radioOnForeground,
        'text-decoration': 'none',
        width: (20+maxDigits*10).toString()+'px',
        'font-size': '17px',
        padding: '2px 8px',
        height: stdHeight,
        'box-sizing': 'border-box',
        'vertical-align': 'bottom'
    };
    return html`<input style=${css} value=${props.name} onInput=${props.callback} ></input>`;
}

export type IntRangeSelectorProps = {
    name: string,
    validRange: [number,number],
    theme: theme.ThemeColors,
    callback: (ival: number) => void
}

export function IntRangeSelector(props: IntRangeSelectorProps) {
    const ival = useSignal(props.validRange[0]);
    useSignalEffect(() => {
        const constrained = constrainWithRange(props.validRange, ival.value);
        if (typeof constrained == 'number') {
            ival.value = constrained;
        }
        props.callback(ival.value);
    });
    function onBeg(event: Event) {
        ival.value = props.validRange[0];
    }
    function onEnd(event: Event) {
        ival.value = props.validRange[1] - 1;
    }
    function onDec(event: Event) {
        if (ival.value > props.validRange[0]) {
            ival.value -= 1;
        }
    }
    function onInc(event: Event) {
        if (ival.value < props.validRange[1] - 1) {
            ival.value += 1;
        }
    }
    function onSet(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            ival.value = parseInt(event.target.value);
        }
    }
    return html`
        ${ThemeLabel({ name: props.name, theme: props.theme })}
        ${ThemeButton({ name: "|<", theme: props.theme, callback: onBeg})}
        ${ThemeRepButton({ name: "<", theme: props.theme, callback: onDec})}
        ${ThemeInt({ name: ival.value.toString(), min: props.validRange[0], max: props.validRange[1] - 1, theme: props.theme, callback: onSet })}
        ${ThemeRepButton({ name: ">", theme: props.theme, callback: onInc})}
        ${ThemeButton({ name: ">|", theme: props.theme, callback: onEnd})}
    `
}

export type MotorRangeSelectorProps = {
    name: string,
    coarseRange: [number, number],
    fineRange: [number, number] | null,
    theme: theme.ThemeColors,
    callback: (coarse: number,fine: number) => void
}

export function MotorRangeSelector(props: MotorRangeSelectorProps) {
    const coarse = useSignal(props.coarseRange[0]);
    const fine = useSignal(props.fineRange ? props.fineRange[0] : 0);
    useSignalEffect(() => {
        const constrained = constrainWithRange(props.coarseRange, coarse.value);
        if (typeof constrained == 'number') {
            coarse.value = constrained;
        }
        props.callback(coarse.value,fine.value);
    });
    function onBeg(event: Event) {
        coarse.value = props.coarseRange[0];
        fine.value = props.fineRange ? props.fineRange[0] : 0;
    }
    function onEnd(event: Event) {
        coarse.value = props.coarseRange[1] - 1;
        fine.value = props.fineRange ? props.fineRange[0] : 0;
    }
    function onDec(event: Event) {
        if (coarse.value > props.coarseRange[0]) {
            coarse.value -= 1;
        }
    }
    function onInc(event: Event) {
        if (coarse.value < props.coarseRange[1] - 1) {
            coarse.value += 1;
        }
    }
    function onSet(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            coarse.value = parseInt(event.target.value);
        }
    }
    function onIncFine(state: number) {
        fine.value = state;
    }
    return html`
        ${ThemeLabel({ name: props.name, theme: props.theme })}
        ${ThemeButton({ name: "|<", theme: props.theme, callback: onBeg})}
        ${ThemeRepButton({ name: "<", theme: props.theme, callback: onDec })}
        ${ThemeInt({ name: coarse.value.toString(), min: props.coarseRange[0], max: props.coarseRange[1] - 1, theme: props.theme, callback: onSet })}
        ${props.fineRange ? MultiStateButton({ numStates: 4, states: ["+","+","+","+"], theme: props.theme, callback: onIncFine }) : html``}
        ${ThemeRepButton({ name: ">", theme: props.theme, callback: onInc})}
        ${ThemeButton({ name: ">|", theme: props.theme, callback: onEnd})}
    `
}

export type IntMapSelectorProps = {
    name: string,
    ikey: Signal<number>,
    validList: Signal<number[]>, // cannot be empty list
    theme: theme.ThemeColors,
}

export function IntMapSelector(props: IntMapSelectorProps) {
    const ival = useSignal(props.validList.value[props.ikey.value]);
    useSignalEffect(() => {
        if (props.ikey.value < 0 || props.ikey.value >= props.validList.value.length) {
            batch(() => {
                props.ikey.value = 0;
                ival.value = props.validList.value[0];
            });
            return;
        }
        const constrained = constrainWithList(props.validList.value, ival.value);
        if (typeof constrained == 'number') {
            batch(() => {
                props.ikey.value = props.validList.value.findIndex((x) => x == constrained);
                ival.value = constrained;
            });
        } else {
            ival.value = props.validList.value[props.ikey.value];
        }
    });
    function onDec(event: Event) {
        let i = props.ikey.value;
        const min = Math.min(...props.validList.value);
        const max = Math.max(...props.validList.value);
        const [oldKey, oldVal] = [i, props.validList.value[i]];
        let [newKey, newVal] = [null, null];
        do {
            i -= 1;
            if (i < 0) {
                if (newKey == null && oldVal == min && min != max) {
                    const rev = new Array<number>(...props.validList.value).reverse();
                    [newKey, newVal] = [rev.length - 1 - rev.findIndex((x) => x == max), max];
                    break;
                } else if (newKey == null && oldVal == min && min == max) {
                    [newKey, newVal] = [props.validList.value.length - 1, max];
                    break;
                }
                i = props.validList.value.length - 1;
            }
            if (i == props.ikey.value) {
                break;
            }
            if (props.validList.value[i] <= oldVal) {
                if (i > oldKey && props.validList.value[i] == oldVal) {
                    continue;
                }
                if (newKey==null || newVal==null || props.validList.value[i] > newVal) {
                    [newKey, newVal] = [i, props.validList.value[i]];
                }
            }
        } while (true);
        props.ikey.value = newKey;
    }
    function onInc(event: Event) {
        let i = props.ikey.value;
        const min = Math.min(...props.validList.value);
        const max = Math.max(...props.validList.value);
        const [oldKey, oldVal] = [i, props.validList.value[i]];
        let [newKey, newVal] = [null, null];
        do {
            i += 1;
            if (i >= props.validList.value.length) {
                if (newKey == null && oldVal == max && min != max) {
                    [newKey, newVal] = [props.validList.value.findIndex((x) => x == min), min];
                    break;
                } else if (newKey == null && oldVal == max && min == max) {
                    [newKey, newVal] = [0, min];
                    break;
                }
                i = 0;
            }
            if (i == props.ikey.value) {
                break;
            }
            if (props.validList.value[i] >= oldVal) {
                if (i < oldKey && props.validList.value[i] == oldVal) {
                    continue;
                }
                if (newKey==null || newVal==null || props.validList.value[i] < newVal) {
                    [newKey, newVal] = [i, props.validList.value[i]];
                }
            }
        } while (true);
        props.ikey.value = newKey;
    }
    function onSet(event: Event) {
        if (event.target instanceof HTMLInputElement) {
            const rawVal = parseInt(event.target.value);
            const constrained = constrainWithList(props.validList.value, rawVal);
            if (typeof constrained == 'number') {
                props.ikey.value = props.validList.value.findIndex((x) => x==constrained);
            } else {
                props.ikey.value = props.validList.value.findIndex((x) => x==rawVal);
            }
        }
    }
    return html`
        ${ThemeLabel({ name: props.name, theme: props.theme })}
        ${ThemeRepButton({ name: "<", theme: props.theme, callback: onDec})}
        ${ThemeInt({ name: ival.value.toString(), min: Math.min(...props.validList.value), max: Math.max(...props.validList.value), theme: props.theme, callback: onSet })}
        ${ThemeRepButton({ name: ">", theme: props.theme, callback: onInc})}
    `
}