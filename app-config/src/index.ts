import { inspect } from 'util';
import { loadValidatedConfig, Options } from './config';
import { AppConfigError, AccessingAppConfig } from './errors';
import { logger } from './logging';

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}

// the export of this module is a proxy in front of this value
let loadedConfig: ExportedConfig | undefined;

const assertLoaded = () => {
  if (!loadedConfig) {
    throw new AccessingAppConfig('Tried to read app-config value before calling loadConfig!');
  }
  return loadedConfig;
};

export async function loadConfig(options?: Options): Promise<ExportedConfig> {
  if (loadedConfig) {
    logger.warn('Called loadConfig, even though config was already loaded elsewhere');
  }

  const { fullConfig } = await loadValidatedConfig(options);

  loadedConfig = fullConfig as ExportedConfig;

  return config;
}

export const config: ExportedConfig = new Proxy(
  {
    APP_CONFIG_WAS_NOT_LOADED_YET_LOOK_AT_THE_DOCS: true,

    [inspect.custom]() {
      return inspect(assertLoaded());
    },
    toJSON() {
      return assertLoaded();
    },
  },
  {
    ownKeys() {
      return Reflect.ownKeys(assertLoaded());
    },
    has(_, key) {
      return key in assertLoaded();
    },
    get(_, prop): unknown {
      return Reflect.get(assertLoaded(), prop);
    },
    getOwnPropertyDescriptor(_, key) {
      return Object.getOwnPropertyDescriptor(assertLoaded(), key);
    },
    set() {
      throw new AppConfigError('Setting properties on app-config is not allowed');
    },
    defineProperty() {
      throw new AppConfigError('Setting properties on app-config is not allowed');
    },
    deleteProperty() {
      throw new AppConfigError('Deleting properties from app-config is not allowed');
    },
    isExtensible() {
      return false;
    },
  },
);

export default config;

export {
  loadValidatedConfig,
  loadConfig as loadUnvalidatedConfig,
  Options as ConfigLoadingOptions,
} from './config';
export { loadSchema, Options as SchemaLoadingOptions } from './schema';
export { loadMetaConfig } from './meta';
export { setLogLevel, LogLevel } from './logging';
export { currentEnvironment, defaultAliases } from './environment';
export { ParsedValue, ParsedValueMetadata } from './parsed-value';
export {
  ConfigSource,
  FileSource,
  FlexibleFileSource,
  EnvironmentSource,
  LiteralSource,
  CombinedSource,
  FallbackSource,
  FileType,
  stringify,
  filePathAssumedType,
  parseRawString,
} from './config-source';

/** @hidden */
export function resetConfigInternal() {
  loadedConfig = undefined;
}
