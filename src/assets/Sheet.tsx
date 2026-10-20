import type {ComponentType} from 'react';
import {AbsoluteFill} from 'frameforge';
import {CATALOG} from './catalog';
import * as kit from './index';
import type {ArtProps} from './system';

export const SHEET_PAGE_SIZE = 24;
const components = kit as unknown as Record<string, ComponentType<ArtProps>>;

/** Contact sheet: 24 assets per 1920×1080 page (8×3 cells of 240×360), each at 200 px over its name, at rest. */
export const AssetSheet = ({page = 0}: {page?: number}) => <AbsoluteFill style={{background: '#f3eee5', display: 'grid', gridTemplateColumns: 'repeat(8, 240px)', gridTemplateRows: 'repeat(3, 360px)', placeItems: 'center'}}>
  {CATALOG.slice(page * SHEET_PAGE_SIZE, (page + 1) * SHEET_PAGE_SIZE).map(({name}) => {
    const Art = components[name]!;
    return <div key={name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
      <Art size={200} />
      <div style={{font: '600 26px system-ui, sans-serif', color: '#1f1d2b'}}>{name}</div>
    </div>;
  })}
</AbsoluteFill>;
