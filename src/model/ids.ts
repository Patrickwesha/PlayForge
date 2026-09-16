import { nanoid } from 'nanoid';

/** Player id */
export const pid = () => `p_${nanoid(8)}`;
/** Path (route/block/motion) id */
export const rid = () => `r_${nanoid(8)}`;
/** Annotation id */
export const aid = () => `a_${nanoid(8)}`;
/** Document ids (formation, play, playbook, section) */
export const did = () => nanoid(10);

export const nowIso = () => new Date().toISOString();
