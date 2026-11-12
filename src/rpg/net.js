// Co-op transport for 1-3 players.
// - Supabase Realtime (broadcast + presence) when VITE_SUPABASE_* is configured: real network play,
//   no new tables and no change to the existing auth/session schema.
// - BroadcastChannel fallback: real message passing between tabs/windows of the same browser
//   (useful for local testing and shared-screen classrooms). It is NOT internet multiplayer.
// Membership is ordered by join time; the first member is the host (enemy authority).
// A fourth member is refused, so the party never exceeds three players.
import {db} from '../api.js';

export const MAX_PARTY = 3;
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function makeCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function createParty(code, {name, onMessage, onMembers, onRefused}) {
  const me = {id: rid(), name: String(name || '').slice(0, 24), joined: Date.now()};
  let members = [me], closed = false, channel = null, bc = null, hb = 0;
  const seen = new Map(); // BroadcastChannel presence: id -> {member, last}
  const transport = db ? 'supabase' : 'local';

  function publish() {
    const list = [...members].sort((a, b) => a.joined - b.joined || (a.id < b.id ? -1 : 1));
    const index = list.findIndex(m => m.id === me.id);
    if (index >= MAX_PARTY) { // Too late: the party is full.
      leave();
      onRefused?.();
      return;
    }
    members = list.slice(0, MAX_PARTY);
    onMembers?.(members.map((m, slot) => ({...m, slot, self: m.id === me.id})), members.findIndex(m => m.id === me.id));
  }
  function receive(msg) {
    if (!msg || msg.from === me.id || closed) return;
    onMessage?.(msg);
  }
  function send(type, data = {}) {
    if (closed) return;
    const msg = {type, from: me.id, ...data};
    if (channel) channel.send({type: 'broadcast', event: 'm', payload: msg});
    else if (bc) bc.postMessage(msg);
  }

  if (transport === 'supabase') {
    channel = db.channel('tj-party-' + code, {config: {broadcast: {self: false}, presence: {key: me.id}}});
    channel.on('broadcast', {event: 'm'}, ({payload}) => receive(payload));
    channel.on('presence', {event: 'sync'}, () => {
      const state = channel.presenceState();
      members = Object.values(state).map(v => v[0]).filter(Boolean).map(v => ({id: v.id, name: v.name, joined: v.joined}));
      if (!members.find(m => m.id === me.id)) members.push(me);
      publish();
    });
    channel.subscribe(status => { if (status === 'SUBSCRIBED') channel.track(me); });
  } else {
    bc = new BroadcastChannel('tj-party-' + code);
    bc.onmessage = e => {
      const msg = e.data;
      if (msg?.type === 'hello' || msg?.type === 'bye') {
        if (msg.from === me.id) return;
        if (msg.type === 'bye') seen.delete(msg.from); else {
          const fresh = !seen.has(msg.from);
          seen.set(msg.from, {member: msg.member, last: Date.now()});
          if (fresh) bc.postMessage({type: 'hello', from: me.id, member: me});
        }
        members = [me, ...[...seen.values()].map(v => v.member)];
        publish();
        return;
      }
      receive(msg);
    };
    const beat = () => {
      bc.postMessage({type: 'hello', from: me.id, member: me});
      const now = Date.now(); let changed = false;
      for (const [id, v] of seen) if (now - v.last > 4000) { seen.delete(id); changed = true; }
      if (changed) { members = [me, ...[...seen.values()].map(v => v.member)]; publish(); }
    };
    beat(); hb = setInterval(beat, 1000);
    publish();
  }

  function leave() {
    if (closed) return;
    closed = true; clearInterval(hb);
    try { if (bc) { bc.postMessage({type: 'bye', from: me.id}); bc.close(); } } catch {}
    try { if (channel) { channel.untrack(); db.removeChannel(channel); } } catch {}
  }
  addEventListener('pagehide', leave);
  return {code, me, transport, send, leave, get members() { return members; }};
}
