import { config } from './config.js';
import { statements } from './db.js';

export function currentRulesVersion() {
  return statements.getSetting.get('rules_version') ?? config.rulesVersion;
}

export function setRulesVersion(version) {
  statements.setSetting.run('rules_version', version);
  return version;
}
