// Builder reqs
import { build, BuildOptions } from "esbuild";
import { sys, readConfigFile, findConfigFile, parseJsonConfigFileContent } from "typescript";

// Prebuild reqs
import constants from "./src/constants";
import { resolve } from "path";
import { mkdir, rm, cp, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { root } from "./src/root";
import swaggerConfig from "./src/templates/swagger/config";
import swaggerJSDoc from "swagger-jsdoc";
import { promisify } from "util";
import mv from "mv";
const moveAsync = promisify<string, string, mv.Options>(mv);

const cwd = process.cwd();
console.time("Built time");
(async function () {
	const { esbuildOptions } = getEsbuildMetadata({ esbuild: { minify: true } });
	const buildPath = resolve(__dirname, constants.BUILD_PATH);
	const templatePath = resolve(buildPath, "templates");
	const buildConfigPath = resolve(buildPath, "config");

	//  Pre build functions here
	if (existsSync(buildPath)) await rm(buildPath, { recursive: true });
	await mkdir(buildPath);
	// Generate Swagger
	const spec = swaggerJSDoc(swaggerConfig);

	// Builder
	await build({
		bundle: false,
		format: "cjs",
		platform: "node",
		...esbuildOptions,
	});

	// Post build functions here
	// Remove unecessary codes
	if (existsSync(resolve(templatePath, "swagger/config.js"))) await rm(resolve(templatePath, "swagger/config.js"));
	await writeFile(resolve(templatePath, "swagger/swagger-output.json"), JSON.stringify(spec));

	// Copy config path
	await mkdir(buildConfigPath);
	await cp(resolve(root, "src/config"), buildConfigPath, { recursive: true });

	// mv templates email
	if (!existsSync(resolve(root, "dist/templates/email")))
		await moveAsync(resolve(root, "src/templates/email"), resolve(root, "dist/templates/email"), { mkdirp: true });
})()
	.then(() => {
		console.timeEnd("Built time");
		process.exit(0);
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});

/**************************************************************************************/
function getTSConfig(_tsConfigFile = "tsconfig.json") {
	const tsConfigFile = findConfigFile(cwd, sys.fileExists, _tsConfigFile);
	if (!tsConfigFile) throw new Error(`tsconfig.json not found in the current directory! ${cwd}`);

	const configFile = readConfigFile(tsConfigFile, sys.readFile);
	const tsConfig = parseJsonConfigFileContent(configFile.config, sys, cwd);
	return { tsConfig, tsConfigFile };
}
function esBuildSourceMapOptions(tsConfig: any) {
	const { sourceMap, inlineSources, inlineSourceMap } = tsConfig.options;
	// inlineSources requires either inlineSourceMap or sourceMap
	if (inlineSources && !inlineSourceMap && !sourceMap) return false;

	// Mutually exclusive in tsconfig
	if (sourceMap && inlineSourceMap) return false;

	if (inlineSourceMap) return "inline";

	return sourceMap;
}
function getEsbuildMetadata(userConfig: { esbuild: BuildOptions; tsConfigFile?: any }) {
	const { tsConfig, tsConfigFile } = getTSConfig(userConfig.tsConfigFile);
	const esbuildConfig = userConfig.esbuild || {};
	const outdir = esbuildConfig.outdir || tsConfig.options.outDir || "dist";
	const srcFiles = [...((esbuildConfig.entryPoints as string[]) ?? []), ...tsConfig.fileNames];
	const sourcemap = userConfig.esbuild?.sourcemap || esBuildSourceMapOptions(tsConfig);
	const target = esbuildConfig?.target || tsConfig?.raw?.compilerOptions?.target || "esNext";
	const esbuildOptions = {
		...userConfig.esbuild,
		outdir,
		entryPoints: srcFiles,
		sourcemap,
		target: target.toLowerCase(),
		tsconfig: tsConfigFile,
	};
	return { esbuildOptions };
}
