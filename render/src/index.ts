import type { RendererContext, ActivationFunction } from 'vscode-notebook-renderer';
import { h, render } from 'preact';
import { useSignal } from '@preact/signals'
import { html } from 'htm/preact';
import * as explore from './explore.js';
import * as tracks from './tracks.js';
import * as component from './component.js';
import * as mess_base from '../../messages/src/base.js';
import * as mess_trk from '../../messages/src/trk.js';
import * as mess_xp from '../../messages/src/explore.js';
import * as mess_theme from '../../messages/src/themes.js';

export type MethodChooserProps = {
  callback: (which: string) => void,
  which: string,
  has_nibbles: boolean,
  theme: mess_theme.ThemeColors
};

export function MethodChooser(props: MethodChooserProps) {
  const which = useSignal("auto");
  function onSelect(event: Event) {
    if (event.target instanceof HTMLButtonElement) {
      which.value = event.target.textContent;
      props.callback(which.value);
    }
  }
  function getState(nm: string): string {
    const disabled_map = { "auto": !props.has_nibbles, "fast": !props.has_nibbles, "analyze": !props.has_nibbles, "emulate": !props.has_nibbles };
    return disabled_map[nm] ? "disabled" : (which.value == nm ? "on" : "off");
  }
  return html`
    <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      ${component.ThemeRadio({ name: "auto", state: getState("auto"), theme: props.theme, callback: onSelect })}
      ${component.ThemeRadio({ name: "fast", state: getState("fast"), theme: props.theme, callback: onSelect })}
      ${component.ThemeRadio({ name: "analyze", state: getState("analyze"), theme: props.theme, callback: onSelect })}
      ${component.ThemeRadio({ name: "emulate", state: getState("emulate"), theme: props.theme, callback: onSelect })}
    </div>
  `;
}

type ModeChooserProps = {
  callback: (which: string) => void,
  which: string,
  file_system: string | null,
  has_geometry: boolean,
  has_nibbles: boolean,
  theme: mess_theme.ThemeColors
};

function ModeChooser(props: ModeChooserProps) {
  const which = useSignal(props.file_system ? "Catalog" : (props.has_geometry ? "Sectors" : (props.has_nibbles ? "Nibbles" : "none")));
  function onSelect(event: Event) {
    if (event.target instanceof HTMLButtonElement) {
      which.value = event.target.textContent;
      props.callback(which.value);
    }
  }
  function getState(nm: string): string {
    const disabled_map = { "Catalog": !props.file_system, "Blocks": !props.file_system, "Sectors": !props.has_geometry, "Nibbles": !props.has_nibbles };
    return disabled_map[nm] ? "disabled" : (which.value == nm ? "on" : "off");
  }
  return html`
    <div style=${{ 'padding-top': '10px', clear: 'left' }}>
      ${component.ThemeRadio({ name: "Catalog", state: getState("Catalog"), theme: props.theme, callback: onSelect })}
      ${component.ThemeRadio({ name: "Nibbles", state: getState("Nibbles"), theme: props.theme, callback: onSelect })}
      ${component.ThemeRadio({ name: "Sectors", state: getState("Sectors"), theme: props.theme, callback: onSelect })}
      ${component.ThemeRadio({ name: "Blocks", state: getState("Blocks"), theme: props.theme, callback: onSelect })}
    </div>
  `;
}

type DisplayProps = {
  img_hash: string,
  has_nibbles: boolean,
  geometry: mess_base.Geometry | null,
  stat: mess_base.Stat | null,
  ctx: RendererContext<any>,
  root_path: string | null,
  root_files: mess_base.DirectoryRow[] | null,
  start_path: string | null,
  start_files: mess_base.DirectoryRow[] | null,
  start_method: "auto",
  theme: mess_theme.ThemeColors
};

function Display(props: DisplayProps) {
  const mode = useSignal(props.stat ? "Catalog" : "Sectors");
  props.ctx.onDidReceiveMessage(messg => {
    // TODO: can anything be done about this?
    if (mess_base.ReferencesWereDeleted.test(messg) && messg.img_hash == props.img_hash) {
      console.log(props.stat.fs_name + " label " + props.stat.label + " received deletion notice");
    }
  });
  const onMode = (updated: string) => {
    //console.log("mode change "+updated);
    mode.value = updated;
    if (updated == "Catalog") {
      props.ctx.postMessage(new mess_xp.ChangeDirectory(props.root_path, "", props.img_hash));
    } else if (updated == "Blocks") {
      props.ctx.postMessage(new mess_trk.LoadBlock(props.stat.block_beg, props.img_hash));
    } else if (updated == "Sectors") {
      props.ctx.postMessage(new mess_trk.LoadSector(0, tracks.StartingAngle(props.geometry.tracks), props.img_hash));
    } else if (updated == "Nibbles") {
      props.ctx.postMessage(new mess_trk.LoadNibbles(0, 0, props.img_hash));
    }
  }
  const onMethod = (which: string) => {
    props.ctx.postMessage(new mess_base.ChangeMethod(which, props.img_hash));
  }
  const methodProps: MethodChooserProps = {
    callback: onMethod,
    which: "auto",
    has_nibbles: props.has_nibbles,
    theme: props.theme
  };
  const chooserProps: ModeChooserProps = {
    callback: onMode,
    which: mode.value,
    has_geometry: props.geometry && props.geometry.tracks != null,
    has_nibbles: props.has_nibbles,
    file_system: props.stat == null ? null : props.stat.fs_name,
    theme: props.theme
  };
  if (mode.value == "Catalog") {
    const exploreProps: explore.ExploreProps = {
      img_hash: props.img_hash,
      root_path: props.root_path,
      root_files: props.root_files,
      start_path: props.start_path,
      start_files: props.start_files,
      stat: props.stat,
      theme: props.theme,
      ctx: props.ctx
    }
    return html`
    ${h(MethodChooser, methodProps)}
    ${h(ModeChooser, chooserProps)}
    ${h(explore.Explore, exploreProps)}
    `;
  } else if (mode.value == "Sectors") {
    const secProps: tracks.DisplaySectorProps = {
      img_hash: props.img_hash,
      geometry: props.geometry,
      startingDisplay: "Choose Sector",
      ctx: props.ctx,
      theme: props.theme
    };
    return html`
    ${h(MethodChooser, methodProps)}
    ${h(ModeChooser, chooserProps)}
    ${h(tracks.DisplaySector, secProps)}
    `;
  } else if (mode.value == "Blocks") {
    const blockProps: tracks.DisplayBlockProps = {
      img_hash: props.img_hash,
      stat: props.stat,
      startingDisplay: "Choose Block",
      ctx: props.ctx,
      theme: props.theme
    }
    return html`
    ${h(MethodChooser, methodProps)}
    ${h(ModeChooser, chooserProps)}
    ${h(tracks.DisplayBlock, blockProps)}
    `;
  } else if (mode.value == "Nibbles") {
    const nibbleProps: tracks.DisplayNibbleProps = {
      img_hash: props.img_hash,
      geometry: props.geometry,
      startingDisplay: "Choose Track",
      ctx: props.ctx,
      theme: props.theme
    }
    return html`
    ${h(MethodChooser, methodProps)}
    ${h(ModeChooser, chooserProps)}
    ${h(tracks.DisplayNibbles, nibbleProps)}
    `;
  }
}

export const activate: ActivationFunction = context => ({
  renderOutputItem(data, element) {
    const messg: mess_base.CreateInteractive = data.json();
    const props: DisplayProps = {
      img_hash: messg.img_hash,
      has_nibbles: messg.has_nibbles,
      geometry: messg.geometry,
      stat: messg.stat,
      root_path: messg.root_path,
      root_files: messg.root_files,
      start_path: messg.start_path,
      start_files: messg.start_files,
      start_method: "auto",
      theme: messg.color_theme,
      ctx: context,
    }
    render(h(Display, props), element);
  }
});