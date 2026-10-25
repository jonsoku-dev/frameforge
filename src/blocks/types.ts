/** One catalogue entry: how skills and the studio name a block. */
export type BlockEntry = {id: string; title: string; family: 'text' | 'lower-third' | 'card' | 'chart' | 'code' | 'diagram' | 'map' | 'kinetic'; props: string[]; sample?: string; when?: string};
