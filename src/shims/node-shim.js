// Node module shim for Vite browser builds
export default {};
export const existsSync = () => false;
export const readFileSync = () => "";
export const writeFileSync = () => { };
export const resolve = (...args) => args.join("/");
export const join = (...args) => args.join("/");
export const dirname = () => "";
export const createHmac = () => ({ update: () => ({ digest: () => "" }) });
export const cwd = () => "/";
