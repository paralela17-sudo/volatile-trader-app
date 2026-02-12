// Robust Node shim for browser environments
export const existsSync = () => false;
export const readFileSync = () => "";
export const writeFileSync = () => { };
export const mkdirSync = () => { }; // Adicionado para evitar erro de build no Vercel
export const resolve = (...args) => args.join('/');
export const join = (...args) => args.join('/');
export const dirname = () => "";
export const platform = () => "browser";
export const process = {
    cwd: () => "/",
    platform: "browser",
    env: {}
};

export const createHmac = () => ({
    update: () => ({
        digest: () => ""
    }),
    digest: () => ""
});

export default {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
    resolve,
    join,
    dirname,
    platform,
    process,
    createHmac
};