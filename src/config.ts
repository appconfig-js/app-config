import * as _ from 'lodash';
import { join } from 'path';
import { parseEnv, getEnvType, findParseableFile, FileType } from './file-loader';

const envVarNames = ['APP_CONFIG'];
const defaultConfigFileName = 'app-config';
const globalConfigExtends = ['APP_CONFIG_CI', 'APP_CONFIG_EXTEND'];

interface ConfigObjectArr extends Array<ConfigSubObject> {}
export type ConfigSubObject = number | boolean | string | ConfigObjectArr | ConfigObject;
export type ConfigObject = {
  [key: string]: ConfigSubObject;
};

export enum ConfigSource {
  File,
  EnvVar,
}

export type LoadedConfig<Conf = ConfigObject> = {
  source: ConfigSource;
  fileType: FileType;
  fileSource?: string;
  config: Conf;
  secrets?: ConfigObject;
  nonSecrets: ConfigObject;
};

export const envAliases: { [key: string]: string[] } = {
  production: ['prod'],
  development: ['dev'],
};

const getEnvFileNames = (files: string[], envType = getEnvType()) => {
  if (!envType) {
    return [];
  }

  const envFiles = [envType].concat(envAliases[envType]);

  return envFiles.reduce(
    (filenames: string[], envFile) => filenames.concat(files.map(f => `${f}.${envFile}`)),
    [],
  );
};

export const loadConfig = async <C = ConfigObject>(
  cwd = process.cwd(),
  {
    fileNameOverride,
    envOverride,
  }: {
    fileNameOverride?: string;
    envOverride?: string;
  } = {},
): Promise<LoadedConfig<C>> => {
  const [envVarConfig] = await Promise.all(
    envVarNames
      .filter(name => !!process.env[name])
      .map(envVar => parseEnv(envVar, undefined, envOverride)),
  );

  if (envVarConfig) {
    const [fileType, config] = envVarConfig;

    return {
      fileType,
      config: (config as unknown) as C,
      source: ConfigSource.EnvVar,
      nonSecrets: config,
    };
  }

  const configFileName = fileNameOverride ?? defaultConfigFileName;

  const configFileNames = [`.${configFileName}`, configFileName];
  const secretsFileNames = [`.${configFileName}.secrets`, `${configFileName}.secrets`];

  const secretEnvConfigFileNames = getEnvFileNames(secretsFileNames, envOverride);
  const secretsConfig = await findParseableFile(
    secretEnvConfigFileNames.concat(secretsFileNames).map(f => join(cwd, f)),
    undefined,
    envOverride,
  );
  const secrets = secretsConfig ? secretsConfig[2] : {};

  const envConfigFileNames = getEnvFileNames(configFileNames, envOverride);
  const mainConfig = await findParseableFile(
    envConfigFileNames.concat(configFileNames).map(f => join(cwd, f)),
    undefined,
    envOverride,
  );

  if (!mainConfig) {
    // make a best attempt at detecting env files without a main one
    const tryFiles = ([] as string[])
      .concat(getEnvFileNames(configFileNames, 'development'))
      .concat(getEnvFileNames(configFileNames, 'production'))
      .concat(getEnvFileNames(configFileNames, 'staging'))
      .concat(getEnvFileNames(configFileNames, 'test'));

    const found = await findParseableFile(
      tryFiles.map(f => join(cwd, f)),
      undefined,
      envOverride,
    );

    if (found && !(envOverride || getEnvType())) {
      throw new Error(
        'Could not find app config. ' +
          `Found ${found[1]}, but you did not define an env (APP_CONFIG_ENV || ENV || NODE_ENV).`,
      );
    } else if (found) {
      throw new Error(
        'Could not find app config. ' +
          `Found ${found[1]}, but your environment was ${envOverride ?? getEnvType()}.`,
      );
    }

    throw new Error('Could not find app config. Expected an environment variable or file.');
  }

  const [fileType, fileSource, nonSecrets] = mainConfig;

  const [globalConfigExtend] = await Promise.all(
    globalConfigExtends
      .filter(name => !!process.env[name])
      .map(envVar => parseEnv(envVar, undefined, envOverride)),
  );

  if (globalConfigExtend) {
    assignProperties(globalConfigExtend[1], nonSecrets as object, secrets as object);
  }

  return {
    fileType,
    fileSource,
    secrets,
    nonSecrets,
    config: (_.merge({}, nonSecrets, secrets) as unknown) as C,
    source: ConfigSource.File,
  };
};

const assignProperties = (globalConfig: any, nonSecrets: object, secrets: object, path = '') => {
  Object.entries(globalConfig).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      assignProperties(value, nonSecrets, secrets, `${path ? `${path}.` : ''}${key}`);
    } else {
      const propPath = `${path ? `${path}.` : ''}${key}`;

      if (_.get(nonSecrets, propPath)) {
        _.set(nonSecrets, propPath, value);
      } else {
        _.set(secrets, propPath, value);
      }
    }
  });
};
