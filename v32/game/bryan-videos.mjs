import { openVideo } from './video-player.mjs';

// Editorial associations only. Verify the exact species before adding a match.
// Audit and public fallback evidence: docs/bryan-videos.md. No reviewed timestamps.
const channel = {
  channelId: 'UCThHy8VljJg3tGmuWxSYdbg',
  channelName: 'Fishing With Bryan Prokuski',
  channelUrl: 'https://www.youtube.com/@BryanProkuski',
  verifiedOn: '2026-11-08',
};
const videos = new Map([
  ['walleye', {
    id: 'Elu9m3JcOEM',
    title: 'Ice Fishing For WALLEYE with UNDERWATER CAMERA | Mille Lacs Lake | EARLY ICE 2019',
    label: 'Watch Bryan fish for walleye',
    description: 'Bryan fishes for walleye with an underwater camera on early ice at Mille Lacs.',
    relationship: 'fishing',
    evidence: { type: 'title', note: 'The official upload title identifies walleye.' },
  }],
  ['pike', {
    id: 'gIUtx-C9pKs',
    title: 'SUPER CLEAR Underwater Ice Fishing! BASS & NORTHERN PIKE!',
    label: 'See northern pike on Bryan’s camera',
    description: 'Northern pike visit Bryan’s underwater camera during an ice-fishing trip.',
    relationship: 'appearance',
    evidence: { type: 'title-and-description', note: 'The official title names northern pike; Bryan describes pike passing the camera.' },
  }],
  ['smallmouth', {
    id: 'KL0F_23RvBo',
    title: 'Spring Smallmouth Bass Fishing in Minnesota',
    label: 'Watch Bryan fish for smallmouth bass',
    description: 'Bryan heads out for smallmouth bass between spring rainstorms in Minnesota.',
    relationship: 'fishing',
    evidence: { type: 'title', note: 'The official upload title identifies smallmouth bass and spring fishing.' },
  }],
  ['muskie', {
    id: 'W41Btej9DnI',
    title: 'MUSKIE! Ice Fishing Perch on Mille Lacs Lake',
    label: 'See a muskie visit Bryan’s camera',
    description: 'A muskie visits Bryan’s underwater camera during a perch outing on Mille Lacs. This is an appearance, not a muskie catch.',
    relationship: 'appearance',
    evidence: { type: 'title-and-description', note: 'The title names muskie; Bryan’s description identifies a muskie visiting during the perch outing.' },
  }],
].map(([speciesId, video]) => [speciesId, Object.freeze({
  ...channel, ...video, speciesId,
  url: 'https://www.youtube.com/watch?v=' + video.id,
  evidence: Object.freeze(video.evidence),
})]));

/** null means keep the species reference and omit a contextual video action. */
export function getBryanVideo(speciesId) {
  return videos.get(speciesId) ?? null;
}

/** Caller holds local suspension and releases its own hold in onClose. */
export function openBryanVideo(speciesId, options = {}) {
  return openVideo(getBryanVideo(speciesId), options);
}
