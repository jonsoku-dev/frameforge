import * as kit from './index';
import type {ArtMeta} from './system';

/** Every kit asset's meta in index order (index.tsx re-exports each as `<Name>Meta`); the resolver matches intents against `tags`. */
export const CATALOG: ArtMeta[] = Object.entries(kit).filter(([key]) => key.endsWith('Meta')).map(([, meta]) => meta as ArtMeta);
