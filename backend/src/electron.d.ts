declare namespace NodeJS {
  interface Process {
    resourcesPath?: string;
  }
}

declare module 'electron' {
  export const app: any;
}
