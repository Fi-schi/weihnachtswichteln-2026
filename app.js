/* Öffentliche GitHub-Pages-Seite. Keine personenbezogenen Klartextdaten im Repository. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const status = $('status');

  function fromBase64url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Ungültiger Geheimlink');
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  function showError(message) {
    status.textContent = message;
    status.classList.add('error');
    $('ready').classList.add('hidden');
  }
  function showText(id, text) { $(id).textContent = text; }
  function renderEvent(event) {
    if (!event || typeof event !== 'object') return;
    if (typeof event.title === 'string' && event.title.trim()) {
      showText('event-title', event.title.slice(0, 100));
      document.title = `${event.title.slice(0, 100)} · Dein Los`;
    }
    if (event.budget && typeof event.budget === 'string') {
      showText('budget', event.budget.slice(0, 100));
      $('budget-row').classList.remove('hidden');
    }
    if (typeof event.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      const d = new Date(`${event.date}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        showText('date', new Intl.DateTimeFormat('de-DE', {dateStyle:'long'}).format(d));
        $('date-row').classList.remove('hidden');
      }
    }
    if (event.note && typeof event.note === 'string') {
      showText('note', event.note.slice(0, 500));
      $('note').classList.remove('hidden');
    }
    if (['budget-row','date-row','note'].some(id => !$(id).classList.contains('hidden'))) $('details').classList.remove('hidden');
  }
  async function main() {
    const response = await fetch('data.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Datei data.json nicht erreichbar');
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.assignments)) throw new Error('Nicht unterstützte Datenversion');
    renderEvent(data.event);
    const fragment = new URLSearchParams(window.location.hash.substring(1)).get('w');
    if (!fragment) {
      status.textContent = data.assignments.length
        ? 'Willkommen! Öffne deinen persönlichen Wichtellink, um dein geheimes Los zu sehen.'
        : 'Die Wichtel-Auslosung ist noch nicht veröffentlicht. Bald geht es los!';
      return;
    }
    const match = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(fragment);
    if (!match) { showError('Dieser Wichtellink ist ungültig. Bitte frage die organisierende Person nach deinem persönlichen Link.'); return; }
    const [, id, encodedKey] = match;
    const record = data.assignments.find((row) => row.id === id);
    if (!record) { showError('Für diesen Link wurde kein Wichtellos gefunden. Wurde die Auslosung inzwischen erneuert?'); return; }
    if (!window.crypto || !crypto.subtle) { showError('Dieser Browser unterstützt die notwendige Verschlüsselung nicht. Bitte aktualisiere deinen Browser.'); return; }
    try {
      const rawKey = fromBase64url(encodedKey);
      if (rawKey.length !== 32) throw new Error('Falsche Schlüssellänge');
      const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt(
        {name:'AES-GCM', iv:fromBase64url(record.iv), additionalData:new TextEncoder().encode(id)},
        key,
        fromBase64url(record.payload)
      );
      const assignment = JSON.parse(new TextDecoder().decode(plain));
      if (assignment.version !== 1 || typeof assignment.giver !== 'string' || typeof assignment.recipient !== 'string') throw new Error('Ungültiges Los');
      status.textContent = '';
      showText('greeting', `Hallo ${assignment.giver}! ✨`);
      $('ready').classList.remove('hidden');
      $('reveal-btn').addEventListener('click', () => {
        $('reveal-btn').classList.add('hidden');
        showText('recipient', assignment.recipient);
        $('answer').classList.remove('hidden');
      }, {once:true});
    } catch (error) {
      showError('Dieses Los lässt sich nicht entschlüsseln. Prüfe, ob du den vollständigen, aktuellen Link erhalten hast.');
    }
  }
  main().catch(() => showError('Die Wichteldaten konnten nicht geladen werden. Bitte versuche es später noch einmal.'));
})();
