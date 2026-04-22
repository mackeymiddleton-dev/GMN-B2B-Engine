const store = {};

function get(sessionId) {
  return store[sessionId] || null;
}

function set(sessionId, session) {
  store[sessionId] = session;
}

function update(sessionId, updates) {
  if (!store[sessionId]) return;
  store[sessionId] = { ...store[sessionId], ...updates };
  return store[sessionId];
}

function getAll() {
  return store;
}

module.exports = { get, set, update, getAll };
