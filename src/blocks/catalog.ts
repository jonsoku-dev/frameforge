import type {BlockEntry} from './types';
import {TEXT_BLOCKS} from './text';
import {LOWER_THIRD_BLOCKS} from './lower-thirds';
import {CARD_BLOCKS} from './cards';
import {CHART_BLOCKS} from './charts';
import {CODE_BLOCKS} from './code';
import {DIAGRAM_BLOCKS} from './diagrams';
import {MAP_BLOCKS} from './maps';
import {KINETIC_BLOCKS} from './kinetic';

export const CATALOG: readonly BlockEntry[] = [...TEXT_BLOCKS, ...LOWER_THIRD_BLOCKS, ...CARD_BLOCKS, ...CHART_BLOCKS, ...CODE_BLOCKS, ...DIAGRAM_BLOCKS, ...MAP_BLOCKS, ...KINETIC_BLOCKS];
