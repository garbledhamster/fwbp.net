import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBryanVideo, openBryanVideo } from './bryan-videos.mjs';

// Catch a guessed association, mismatched upload or unsupported species fallback.
test('only verified exact species have contextual Bryan footage', () => {
  for (const [species, id, relationship] of [
    ['walleye', 'Elu9m3JcOEM', 'fishing'],
    ['pike', 'gIUtx-C9pKs', 'appearance'],
    ['smallmouth', 'KL0F_23RvBo', 'fishing'],
    ['muskie', 'W41Btej9DnI', 'appearance'],
  ]) {
    const video = getBryanVideo(species);
    assert.equal(video.id, id);
    assert.equal(video.relationship, relationship);
    assert.equal(video.url, 'https://www.youtube.com/watch?v=' + id);
    assert.equal(video.channelId, 'UCThHy8VljJg3tGmuWxSYdbg');
    assert.ok(video.evidence.note);
    assert.equal(video.startSeconds, undefined, 'no timestamp has been reviewed');
  }
  for (const species of ['perch', 'rock-bass', 'bass', 'unknown', '__proto__', null, undefined]) {
    assert.equal(getBryanVideo(species), null);
    assert.equal(openBryanVideo(species), false);
  }
});
