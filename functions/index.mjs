import { createHash, randomBytes, randomInt } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { apply, publicRun, runLifetime, start } from './rules.mjs';

initializeApp();
const db = getFirestore();
const digest = value => createHash('sha256').update(value).digest('hex');
const scores = db.collection('fishingScores');
const origins = new Set(['https://fwbp.net', 'https://www.fwbp.net']);

class InvalidMove extends Error {}

export const fishing = onRequest({ region: 'us-central1', maxInstances: 3, timeoutSeconds: 15 }, async (req, res) => {
  const origin = req.get('Origin');
  if (origin && !origins.has(origin)) return res.sendStatus(403);
  if (origin) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    return res.set('Access-Control-Allow-Methods', 'POST')
      .set('Access-Control-Allow-Headers', 'Content-Type, Authorization').sendStatus(204);
  }
  if (req.method !== 'POST' || !req.is('application/json') || (req.rawBody?.length ?? 0) > 512) {
    return res.sendStatus(400);
  }
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.sendStatus(400);
  const { action, version, nickname, ...move } = body;
  const now = Date.now();
  try {
    if (action === 'start') {
      if (Object.keys(body).length !== 1) return res.sendStatus(400);
      const token = randomBytes(32).toString('base64url');
      const run = start(now, () => randomInt(1_000_000) / 1_000_000);
      const hour = Math.floor(now / 3_600_000);
      const bucket = db.collection('fishingStarts').doc(digest(`${req.ip}:${hour}`));
      const ref = db.collection('fishingRuns').doc(digest(token));
      const allowed = await db.runTransaction(async tx => {
        const used = (await tx.get(bucket)).data()?.count ?? 0;
        if (used >= 20) return false;
        tx.set(bucket, { count: used + 1, expireAt: new Date((hour + 2) * 3_600_000) });
        tx.create(ref, { ...run, expireAt: new Date(now + runLifetime) });
        return true;
      });
      return allowed ? res.json({ token, state: publicRun(run), serverNow: Date.now() }) : res.sendStatus(429);
    }
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get('Authorization') ?? '')?.[1];
    if (!token || !Number.isInteger(version)) return res.sendStatus(401);
    const ref = db.collection('fishingRuns').doc(digest(token));
    const state = await db.runTransaction(async tx => {
      const run = (await tx.get(ref)).data();
      if (!run || now >= run.expires) throw new InvalidMove('Outing expired.');
      if (action === 'submit') {
        if (Object.keys(move).length || typeof nickname !== 'string'
          || !/^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,19}$/u.test(nickname.trim())
          || run.stage !== 'done' || run.score <= 0) throw new InvalidMove('Invalid score entry.');
        if (run.submitted) return publicRun(run);
        if (version !== run.version) throw new InvalidMove('Outing changed.');
        tx.create(scores.doc(ref.id), { nickname: nickname.trim(), score: run.score, created: new Date(now) });
        run.submitted = true;
        run.version++;
      } else {
        if (version !== run.version || nickname !== undefined) throw new InvalidMove('Outing changed.');
        try {
          apply(run, { action, ...move }, now);
        } catch (error) {
          throw new InvalidMove(error.message);
        }
      }
      tx.set(ref, run);
      return publicRun(run);
    });
    if (action !== 'submit') return res.json({ state, serverNow: Date.now() });
    const top = await scores.orderBy('score', 'desc').limit(10).get();
    return res.json({ state, board: top.docs.map(doc => {
      const { nickname, score } = doc.data();
      return { nickname, score };
    }) });
  } catch (error) {
    if (error instanceof InvalidMove) return res.status(409).json({ error: error.message });
    console.error(error);
    return res.sendStatus(503);
  }
});
