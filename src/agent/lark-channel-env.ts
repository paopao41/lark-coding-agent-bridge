import { join } from 'node:path';

export interface LarkChannelEnvContext {
  profile?: string;
  rootDir?: string;
  configPath?: string;
  larkCliConfigDir?: string;
  larkCliSourceConfigFile?: string;
  /** Absolute path to the customize directory. When set, exported as
   *  `LARK_CHANNEL_CUSTOMIZE_DIR` so agent-side tools can locate skills /
   *  knowledge / memory files at runtime. Undefined when customize is
   *  disabled or the directory does not exist. */
  customizeDir?: string;
}

export function buildLarkChannelEnv(context?: LarkChannelEnvContext): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    LARK_CHANNEL: '1',
  };
  const profile = nonEmpty(context?.profile);
  if (profile) env.LARK_CHANNEL_PROFILE = profile;

  const rootDir = nonEmpty(context?.rootDir);
  if (rootDir) env.LARK_CHANNEL_HOME = rootDir;

  const configPath =
    nonEmpty(context?.larkCliSourceConfigFile) ??
    nonEmpty(context?.configPath) ??
    (rootDir ? join(rootDir, 'config.json') : undefined);
  if (configPath) env.LARK_CHANNEL_CONFIG = configPath;

  const larkCliConfigDir = nonEmpty(context?.larkCliConfigDir);
  if (larkCliConfigDir) env.LARKSUITE_CLI_CONFIG_DIR = larkCliConfigDir;

  const customizeDir = nonEmpty(context?.customizeDir);
  if (customizeDir) env.LARK_CHANNEL_CUSTOMIZE_DIR = customizeDir;

  return env;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? value : undefined;
}
