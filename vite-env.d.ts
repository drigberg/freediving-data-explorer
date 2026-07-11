/// <reference types="vite/client" />
/// <reference types="vitest/config" />

declare module "*.csv?raw" {
  const content: string;
  export default content;
}
