// The game asks for an account before it starts (src/account.js requireAccount, also on /rpg.html since audit №14).
// Without a server that is a local player profile kept in the tj_player cookie; the browser checks play as «QA».
// Cookies ignore the port, so one cookie per host covers every dev/preview port.
const value = encodeURIComponent(JSON.stringify({id: 'qa-check', name: 'QA'}));
export const QA_COOKIES = {cookies: ['localhost', '127.0.0.1'].map(host => ({name: 'tj_player', value, url: `http://${host}/`, path: '/'}))};
