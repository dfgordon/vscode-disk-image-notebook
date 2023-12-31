import type { RendererContext, ActivationFunction } from 'vscode-notebook-renderer';
import { h, render } from 'preact';
import { useState } from 'preact/hooks'
import { html } from 'htm/preact';
import * as explore from './explore.js';
import * as tracks from './tracks.js';
import * as base from '../../messages/src/base.js';
import * as trk_mess from '../../messages/src/trk.js';
import * as xp_mess from '../../messages/src/explore.js';
import * as theme from '../../messages/src/themes.js';

type ChooserProps = {
  handler: (event: Event) => void,
  which: string,
  has_tracks: boolean,
  file_system: string | null,
  has_nibbles: boolean,
  color_theme: theme.ThemeColors
};

type DisplayProps = {
  img_hash: string,
  geometry: base.Geometry | null,
  stat: base.Stat | null,
  ctx: RendererContext<any>,
  root_path: string | null,
  root_files: base.DirectoryRow[] | null,
  start_path: string | null,
  start_files: base.DirectoryRow[] | null,
  color_theme: theme.ThemeColors
};

function ModeChooser(props: ChooserProps) {
  const [which, SetWhich] = useState(props.which);
  const select = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
      const updated = event.target.id;
      SetWhich(updated);
      props.handler(event);
    }
  }
  const css_on = {
    width: '100px',
    height: '20px',
    border: props.color_theme.radioOnBorder,
    'background-color': props.color_theme.radioOnBackground,
    color: props.color_theme.radioOnForeground,
    float: 'left',
    cursor: 'pointer'
  };
  const css_off = {
    width: '100px',
    height: '20px',
    border: props.color_theme.radioOffBorder,
    'background-color': props.color_theme.radioOffBackground,
    color: props.color_theme.radioOffForeground,
    float: 'left',
    cursor: 'pointer'
  }
  const css_disabled = {
    width: '100px',
    height: '20px',
    border: props.color_theme.radioDisabledBorder,
    'background-color': props.color_theme.radioDisabledBackground,
    color: props.color_theme.radioDisabledForeground,
    float: 'left'
  }
  const css_cat = which == "catalog" ? css_on : (props.file_system ? css_off : css_disabled);
  const css_nib = which == "nibble" ? css_on : (props.has_nibbles ? css_off : css_disabled);
  const css_sec = which == "sector" ? css_on : (props.has_tracks ? css_off : css_disabled);
  const css_blk = which == "block" ? css_on : (props.file_system ? css_off : css_disabled);
  return html`
    <div style=${{ clear: 'left' }}>
    <label style=${css_cat}><input type="radio" style=${{ visibility: 'hidden' }} disabled=${!props.file_system} onClick=${select} checked=${which == "catalog"} id="catalog" value="catalog"/>Catalog</label>
    <label style=${css_nib}><input type="radio" style=${{ visibility: 'hidden' }} disabled=${!props.has_nibbles} onClick=${select} checked=${which == "nibble"} id="nibble" value="nibble"/>Nibbles</label>
    <label style=${css_sec}><input type="radio" style=${{ visibility: 'hidden' }} disabled=${!props.has_tracks} onClick=${select} checked=${which == "sector"} id="sector" value="sector"/>Sectors</label>
    <label style=${css_blk}><input type="radio" style=${{ visibility: 'hidden' }} disabled=${!props.file_system} onClick=${select} checked=${which == "block"} id="block" value="block"/>Blocks</label>
    </div>
    `;
}

function Display(props: DisplayProps) {
  const [mode, SetMode] = useState(props.stat ? "catalog" : "sector");
  props.ctx.onDidReceiveMessage(messg => {
    // TODO: can anything be done about this?
    if (base.ReferencesWereDeleted.test(messg) && messg.img_hash == props.img_hash) {
      console.log(props.stat.fs_name + " label " + props.stat.label + " received deletion notice");
    }
  });
  const onMode = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
      const updated = event.target.id;
      //console.log("mode change "+updated);
      SetMode(updated);
      if (updated == "catalog") {
        props.ctx.postMessage(new xp_mess.ChangeDirectory(props.root_path, "", props.img_hash));
      } else if (updated == "block") {
        props.ctx.postMessage(new trk_mess.LoadBlock(props.stat.block_beg, props.img_hash));
      } else if (updated == "sector") {
        props.ctx.postMessage(new trk_mess.LoadSector(0, 0, tracks.StartingSector(props.geometry.tracks[0].chs_map), props.img_hash));
      } else if (updated == "nibble") {
        props.ctx.postMessage(new trk_mess.LoadNibbles(0, 0, props.img_hash));
      }
    }
  }
  const chooserProps: ChooserProps = {
    handler: onMode,
    which: mode,
    has_tracks: props.geometry && props.geometry.tracks != null,
    has_nibbles: props.geometry && props.geometry.tracks != null,
    file_system: props.stat == null ? null : props.stat.fs_name,
    color_theme: props.color_theme
  };
  if (mode == "catalog") {
    const exploreProps: explore.ExploreProps = {
      img_hash: props.img_hash,
      root_path: props.root_path,
      root_files: props.root_files,
      start_path: props.start_path,
      start_files: props.start_files,
      stat: props.stat,
      color_theme: props.color_theme,
      ctx: props.ctx
    }
    return html`
    ${h(ModeChooser, chooserProps)}
    ${h(explore.Explore, exploreProps)}
    `;
  } else if (mode == "sector") {
    const secProps: tracks.DisplaySectorProps = {
      img_hash: props.img_hash,
      geometry: props.geometry,
      startingDisplay: "Choose Sector",
      ctx: props.ctx
    };
    return html`
    ${h(ModeChooser, chooserProps)}
    ${h(tracks.DisplaySector, secProps)}
    `;
  } else if (mode == "block") {
    const blockProps: tracks.DisplayBlockProps = {
      img_hash: props.img_hash,
      stat: props.stat,
      startingDisplay: "Choose Block",
      ctx: props.ctx
    }
    return html`
    ${h(ModeChooser, chooserProps)}
    ${h(tracks.DisplayBlock, blockProps)}
    `;
  } else if (mode == "nibble") {
    const nibbleProps: tracks.DisplayNibbleProps = {
      img_hash: props.img_hash,
      geometry: props.geometry,
      startingDisplay: "Choose Track",
      ctx: props.ctx
    }
    return html`
    ${h(ModeChooser, chooserProps)}
    ${h(tracks.DisplayNibbles, nibbleProps)}
    `;
  }
}

export const activate: ActivationFunction = context => ({
  renderOutputItem(data, element) {
    const messg: base.CreateInteractive = data.json();
    const props: DisplayProps = {
      img_hash: messg.img_hash,
      geometry: messg.geometry,
      stat: messg.stat,
      root_path: messg.root_path,
      root_files: messg.root_files,
      start_path: messg.start_path,
      start_files: messg.start_files,
      color_theme: messg.color_theme,
      ctx: context,
    }
    render(h(Display, props), element);
  }
});