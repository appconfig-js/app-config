// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@lcdev/app-config';

export interface Config {
  user?: User;
}

export interface User {
  name?: string;
}

// augment the default export from app-config
declare module '@lcdev/app-config' {
  export interface ExportedConfig extends Config {}
}
