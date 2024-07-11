import { resolve } from "path";
export const root = resolve(__dirname, "../");
export const configPath = resolve(__dirname, "config", `${process.env.NODE_ENV?.toLowerCase() ?? ""}.json`);
