const crypto = require('crypto');

function classToolsFor(bookingId, subjectName = 'Class', provider = 'zoom') {
  const id = String(bookingId || crypto.randomBytes(6).toString('hex'));
  const room = crypto.randomBytes(10).toString('hex');
  const key = crypto.randomBytes(11).toString('hex');
  const title = encodeURIComponent(`Scholaris ${subjectName} ${id.slice(-6)}`);
  const slug = id.slice(-8);
  return {
    docsUrl: `https://docs.google.com/document/create?title=${title}`,
    whiteboardUrl: `https://excalidraw.com/#room=${room},${key}`,
    meetUrl: provider === 'meet' ? `https://meet.google.com/${slug}` : '',
    teamsUrl: provider === 'teams' ? `https://teams.microsoft.com/l/meetup-join/${slug}` : '',
  };
}

function classToolsMessage({ subjectName, startLabel, zoomJoin, docsUrl, whiteboardUrl, meetUrl, teamsUrl, provider }) {
  const meeting =
    provider === 'meet'
      ? meetUrl && `Google Meet: ${meetUrl}`
      : provider === 'teams'
        ? teamsUrl && `Microsoft Teams: ${teamsUrl}`
        : zoomJoin && `Zoom: ${zoomJoin}`;
  const lines = [
    `Class tools for ${subjectName || 'your lesson'}${startLabel ? ` · ${startLabel}` : ''}.`,
    meeting,
    docsUrl ? `Google Docs: ${docsUrl}` : '',
    whiteboardUrl ? `Whiteboard: ${whiteboardUrl}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

module.exports = { classToolsFor, classToolsMessage };
