function cleanEnv(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cleanBaseUrl(value) {
  return cleanEnv(value).replace(/\/+$/, '');
}

function getEnabledModuleKeys() {
  const rawValue = cleanEnv(process.env.EXPO_PUBLIC_ENABLED_MODULES);

  if (!rawValue) {
    return null;
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanPositiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function cleanBoolean(value, fallback = false) {
  const cleanValue = cleanEnv(value);

  if (!cleanValue) {
    return fallback;
  }

  return cleanValue.toLowerCase() === 'true';
}

export const appConfig = {
  frappeBaseUrl: cleanBaseUrl(process.env.EXPO_PUBLIC_FRAPPE_BASE_URL),
  dikshaBaseUrl: cleanBaseUrl(process.env.EXPO_PUBLIC_DIKSHA_BASE_URL),
  tutorWebSocketUrl: cleanEnv(process.env.EXPO_PUBLIC_TUTOR_WS_URL),
  deploymentId: cleanEnv(process.env.EXPO_PUBLIC_DEPLOYMENT_ID, 'tap-default'),
  partnerId: cleanEnv(process.env.EXPO_PUBLIC_PARTNER_ID, 'tap'),
  allowSampleData: cleanBoolean(process.env.EXPO_PUBLIC_ALLOW_SAMPLE_DATA, false),
  requestTimeoutMs: cleanPositiveNumber(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS, 15000),
  chatConnectTimeoutMs: cleanPositiveNumber(process.env.EXPO_PUBLIC_CHAT_CONNECT_TIMEOUT_MS, 12000),
  enabledModules: getEnabledModuleKeys(),
};

export function hasConfiguredFrappeBackend() {
  return Boolean(appConfig.frappeBaseUrl);
}

export function hasConfiguredDikshaBackend() {
  return Boolean(appConfig.dikshaBaseUrl);
}
