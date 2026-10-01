const crypto = require('crypto');

function classToolsFor(bookingId, subjectName = 'Class') {
  const id = String(bookingId || crypto.randomBytes(6).toString('hex'));
  const room = crypto.randomBytes(10).toString('hex');
  const key = crypto.randomBytes(11).toString('hex');
  const title = encodeURIComponent(`Scholaris ${subjectName} ${id.slice(-6)}`);
  return {
    docsUrl: `https://docs.google.com/document/create?title=${title}`,
    whiteboardUrl: `https://excalidraw.com/#room=${room},${key}`,
  };
}

function classToolsMessage({ subjectName, startLabel, zoomJoin, docsUrl, whiteboardUrl, isTutor }) {
  const lines = [
    `Class tools for ${subjectName || 'your lesson'}${startLabel ? ` · ${startLabel}` : ''}.`,
    zoomJoin ? `Zoom: ${zoomJoin}` : '',
    docsUrl ? `Google Docs: ${docsUrl}` : '',
    whiteboardUrl ? `Whiteboard: ${whiteboardUrl}` : '',
    isTutor ? 'Share these only in the Scholaris app. The student received the same Zoom and board links.' : '',
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = { classToolsFor, classToolsMessage };
