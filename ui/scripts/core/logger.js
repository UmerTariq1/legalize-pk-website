function nowIso() {
  return new Date().toISOString();
}

function getMethod(level) {
  if (level === "error") {
    return console.error;
  }

  if (level === "warn") {
    return console.warn;
  }

  if (level === "debug") {
    return console.debug;
  }

  return console.info;
}

function write(level, event, details = {}) {
  const payload = {
    ts: nowIso(),
    page: window.location.pathname,
    ...details
  };

  const method = getMethod(level);
  method.call(console, `[journey] ${event}`, payload);
}

export function logInfo(event, details = {}) {
  write("info", event, details);
}

export function logWarn(event, details = {}) {
  write("warn", event, details);
}

export function logError(event, details = {}) {
  write("error", event, details);
}

export function startTimer(event, details = {}) {
  write("info", `${event}:start`, details);

  return {
    event,
    startedAt: performance.now(),
    details
  };
}

export function endTimer(timer, details = {}) {
  if (!timer) {
    return;
  }

  const durationMs = Math.round((performance.now() - timer.startedAt) * 100) / 100;
  write("info", `${timer.event}:end`, {
    ...timer.details,
    ...details,
    durationMs
  });
}
