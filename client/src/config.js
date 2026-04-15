const LOCAL_DEFAULT = 'http://localhost:3001';

const getEnvVar = (name, defaultValue = null) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || defaultValue;
  }
  return defaultValue;
};

/**
 * Optional emergency override without rebuilding (set before the bundle loads), e.g. in index.html:
 * <script>window.__CHIRPED_SERVER_URL__ = 'https://your-api.example.com';</script>
 */
function getRuntimeServerOverride() {
  if (typeof window === 'undefined') return null;
  const v = window.__CHIRPED_SERVER_URL__;
  if (typeof v === 'string' && v.trim()) {
    return v.trim().replace(/\/$/, '');
  }
  return null;
}

function isLocalBrowserHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

function resolveServerUrl() {
  const fromBuild = (getEnvVar('REACT_APP_SERVER_URL') || '').trim();
  if (fromBuild) {
    return fromBuild.replace(/\/$/, '');
  }

  const runtime = getRuntimeServerOverride();
  if (runtime) {
    return runtime;
  }

  if (typeof window !== 'undefined') {
    if (isLocalBrowserHost()) {
      return LOCAL_DEFAULT;
    }
    return '';
  }

  return LOCAL_DEFAULT;
}

function resolveServerBaseUrl() {
  const fromBuild = (getEnvVar('REACT_APP_SERVER_BASE_URL') || '').trim();
  if (fromBuild) {
    return fromBuild.replace(/\/$/, '');
  }
  return resolveServerUrl();
}

const SERVER_URL = resolveServerUrl();
const SERVER_BASE_URL = resolveServerBaseUrl();

/** False on production HTTPS (e.g. Vercel) when no API URL was baked in or set on window. */
export function isGameServerConfigured() {
  return Boolean(SERVER_URL && SERVER_URL.length > 0);
}

export const GAME_SERVER_CONFIG_HELP =
  'Set Vercel (or host) environment variable REACT_APP_SERVER_URL to your game API’s HTTPS origin (no trailing slash), then redeploy. On the API server, add this site’s URL to ALLOWED_ORIGINS for CORS.';

/** File name under server /audio/ (spaces ok). Override with REACT_APP_LOBBY_MUSIC_FILE */
const LOBBY_MUSIC_FILE = getEnvVar('REACT_APP_LOBBY_MUSIC_FILE') || 'lobby-loop.mp3';

function lobbyMusicSrc() {
  const base = String(SERVER_BASE_URL || '').replace(/\/$/, '');
  if (!base) {
    return '';
  }
  return `${base}/audio/${encodeURIComponent(LOBBY_MUSIC_FILE)}`;
}

export { SERVER_URL, SERVER_BASE_URL, LOBBY_MUSIC_FILE, lobbyMusicSrc };
