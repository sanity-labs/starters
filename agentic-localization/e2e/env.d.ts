/** Feature files are loaded as strings through Vite's `?raw` suffix. */
declare module '*.feature?raw' {
  const featureText: string
  export default featureText
}
