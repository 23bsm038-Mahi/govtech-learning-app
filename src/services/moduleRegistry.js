import moduleWhitelist from '../config/moduleWhitelist';
import { appConfig } from '../config/appConfig';

function getEnvEnabledModules() {
  return appConfig.enabledModules;
}

export function isModuleEnabled(moduleKey) {
  const envEnabledModules = getEnvEnabledModules();

  if (envEnabledModules) {
    return envEnabledModules.includes(moduleKey);
  }

  return Boolean(moduleWhitelist[moduleKey]);
}

export function getEnabledModules() {
  const envEnabledModules = getEnvEnabledModules();

  if (envEnabledModules) {
    return envEnabledModules;
  }

  return Object.keys(moduleWhitelist).filter((moduleKey) => moduleWhitelist[moduleKey]);
}
