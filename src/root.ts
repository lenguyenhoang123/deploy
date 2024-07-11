import { resolve } from "path";
const root = resolve(__dirname, "../");
const configPath = resolve(__dirname, "config", `${process.env.NODE_ENV.toLowerCase()}.json`);

export { root, configPath };
