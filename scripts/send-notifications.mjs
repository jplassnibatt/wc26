// Sends push notifications via FCM. Run on a schedule by GitHub Actions.
// Free: FCM send is free, and the Firebase Admin SDK service account
// (FIREBASE_SERVICE_ACCOUNT) covers Firestore + Messaging. No Cloud Functions.
//
// Triggers (each fired once, deduped via the `notificationLog/{key}` collection):
//   - kickoff_<id>   : a match has kicked off (group predictions now visible)
//   - result_<id>    : a result was posted
//   - specials_reminder : ~24h before the specials deadline
//   - daily_<date>   : evening heads-up about tomorrow's matches
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('FIREBASE_SERVICE_ACCOUNT not set — nothing to do.');
  process.exit(0);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const messaging = getMessaging();

const schedule = JSON.parse(readFileSync(new URL('../src/data/schedule.json', import.meta.url)));

const now = Date.now();
const HOUR = 3600 * 1000;
const SPECIAL_DEADLINE = Date.UTC(2026, 5, 11, 16, 0); // 2026-06-11 16:00 UTC

// Kickoff (UTC) for a match: schedule stores BST (UTC+1), so subtract 1h.
function lockMs(date, kb) {
  if (!date || !kb) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = kb.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h - 1, mi);
}

const ALL_MATCHES = schedule.phases.flatMap((p) => p.matches);
const MATCH_BY_ID = Object.fromEntries(ALL_MATCHES.map((m) => [String(m.id), m]));

// ---- Build the list of pending events --------------------------------------
const events = []; // { key, title, body, url, tag }

// 1) Kickoffs in the last 6h.
for (const m of ALL_MATCHES) {
  if (!m.home_iso) continue;
  const t = lockMs(m.date, m.kickoff_bst);
  if (t == null) continue;
  if (t <= now && t > now - 6 * HOUR) {
    events.push({
      key: `kickoff_${m.id}`,
      title: `⚽ Começou: ${m.home} x ${m.away}`,
      body: 'Já podes ver os palpites do grupo!',
      url: '/',
      tag: `kickoff_${m.id}`,
    });
  }
}

// 2) Results posted in the last 6h.
const resultsSnap = await db.collection('matchResults').get();
for (const docSnap of resultsSnap.docs) {
  const r = docSnap.data();
  if (r.scoreA == null || r.scoreB == null) continue;
  const updatedMs = r.updatedAt?.toMillis ? r.updatedAt.toMillis() : null;
  if (updatedMs != null && updatedMs <= now - 6 * HOUR) continue; // too old
  const m = MATCH_BY_ID[String(docSnap.id)] || {};
  const home = m.home || 'Casa';
  const away = m.away || 'Fora';
  events.push({
    key: `result_${docSnap.id}`,
    title: `📊 Resultado: ${home} ${r.scoreA}-${r.scoreB} ${away}`,
    body: 'Vê quem acertou no Bolão.',
    url: '/',
    tag: `result_${docSnap.id}`,
  });
}

// 3) Specials reminder, ~24h before the deadline.
if (now >= SPECIAL_DEADLINE - 24 * HOUR && now < SPECIAL_DEADLINE) {
  events.push({
    key: 'specials_reminder',
    title: '⏳ Últimas horas para os Especiais!',
    body: 'Fecha hoje a aposta de marcador, MVP, jovem e seleção surpresa.',
    url: '/',
    tag: 'specials_reminder',
  });
}

// 4) Evening heads-up about tomorrow's matches (UTC 18:00–20:59).
const nowDate = new Date(now);
const utcHour = nowDate.getUTCHours();
if (utcHour >= 18 && utcHour <= 20) {
  const tomorrow = new Date(now + 24 * HOUR).toISOString().slice(0, 10);
  const count = ALL_MATCHES.filter((m) => m.home_iso && m.date === tomorrow).length;
  if (count > 0) {
    events.push({
      key: `daily_${tomorrow}`,
      title: `📅 Amanhã há ${count} jogo${count === 1 ? '' : 's'}`,
      body: 'Mete os teus palpites antes do apito!',
      url: '/',
      tag: `daily_${tomorrow}`,
    });
  }
}

if (events.length === 0) {
  console.log('No pending events.');
  process.exit(0);
}

// ---- Collect recipient tokens (token -> owning uid) ------------------------
const usersSnap = await db.collection('users').get();
const tokenOwner = new Map();
for (const u of usersSnap.docs) {
  const toks = u.data().fcmTokens;
  if (Array.isArray(toks)) for (const tk of toks) if (tk) tokenOwner.set(tk, u.id);
}
const tokens = [...tokenOwner.keys()];
console.log(`${events.length} event(s), ${tokens.length} token(s).`);

if (tokens.length === 0) {
  console.log('No subscribers yet — leaving events un-logged so they can fire later.');
  process.exit(0);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function removeBadTokens(badTokens) {
  const byUser = new Map();
  for (const tk of badTokens) {
    const uid = tokenOwner.get(tk);
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(tk);
  }
  for (const [uid, toks] of byUser) {
    await db.collection('users').doc(uid).update({
      fcmTokens: FieldValue.arrayRemove(...toks),
    }).catch(() => {});
  }
}

// ---- Send each pending event once ------------------------------------------
for (const ev of events) {
  const logRef = db.collection('notificationLog').doc(ev.key);
  const exists = (await logRef.get()).exists;
  if (exists) continue;

  const data = { title: ev.title, body: ev.body, url: ev.url, tag: ev.tag };
  let sent = 0;
  const bad = [];

  for (const batch of chunk(tokens, 500)) {
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      data,
      webpush: { headers: { TTL: '3600', Urgency: 'high' } },
    });
    sent += res.successCount;
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
          bad.push(batch[i]);
        }
      }
    });
  }

  await logRef.set({ sentAt: FieldValue.serverTimestamp(), title: ev.title, recipients: sent });
  if (bad.length) await removeBadTokens(bad);
  console.log(`Sent "${ev.key}" to ${sent} device(s); pruned ${bad.length} stale token(s).`);
}

console.log('Done.');
