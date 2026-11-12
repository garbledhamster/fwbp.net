import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from './worker.mjs';

test('visits and hotdog clicks count each IP independently', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const env = {
    COUNTER_KEY: 'fixture-only',
    DB: {
      prepare(sql) {
        const stmt = sqlite.prepare(sql);
        return {
          first: () => stmt.get(),
          bind: (...values) => ({ run: () => stmt.run(...values) }),
        };
      },
    },
  };
  async function send(path, ip, origin = 'https://fwbp.net') {
    return worker.fetch(new Request('https://counts.fwbp.net' + path, {
      method: ip ? 'POST' : 'GET',
      headers: { Origin: origin, ...(ip && { 'CF-Connecting-IP': ip }) },
    }), env);
  }

  assert.deepEqual(await (await send('/')).json(), { anglers: 0, hotdog: 0 });
  assert.deepEqual(await (await send('/visit', '192.0.2.1')).json(), { anglers: 1, hotdog: 0 });
  assert.deepEqual(await (await send('/visit', '192.0.2.1')).json(), { anglers: 1, hotdog: 0 });
  assert.deepEqual(await (await send('/hotdog', '192.0.2.1')).json(), { anglers: 1, hotdog: 1 });
  assert.deepEqual(await (await send('/hotdog', '192.0.2.1')).json(), { anglers: 1, hotdog: 1 });
  assert.deepEqual(await (await send('/hotdog', '2001:db8::2')).json(), { anglers: 2, hotdog: 2 });
  assert.equal((await send('/visit', '192.0.2.3', 'https://example.com')).status, 403);
  assert.deepEqual(await (await send('/')).json(), { anglers: 2, hotdog: 2 });
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM visitors WHERE length(visitor_key) = 64').get().total, 2);
});
