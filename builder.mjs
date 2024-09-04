// Builder reqs
import { build } from "esbuild";
import { sys, readConfigFile, findConfigFile, parseJsonConfigFileContent } from "typescript";

// Prebuild reqs
import { resolve, dirname } from "path";
import { mkdir, rm, cp, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cwd = process.cwd();

console.time("Built time");

(async function () {
	const { esbuildOptions } = getEsbuildMetadata({ esbuild: { minify: false } });
	const buildPath = resolve(__dirname, "dist");
	const templatePath = resolve(buildPath, "templates");
	const buildConfigPath = resolve(buildPath, "config");
	const swaggerConfigPath = resolve(templatePath, "swagger/config.js");
	const swaggerOutputPath = resolve(templatePath, "swagger/swagger-output.json");
	const emailPath = resolve(templatePath, "email");

	// Pre build functions here
	if (existsSync(buildPath)) await rm(buildPath, { recursive: true });
	await mkdir(buildPath);

	// Builder
	await build({
		bundle: false,
		format: "cjs",
		platform: "node",
		...esbuildOptions,
	});

	// Post build functions here
	const { default: swaggerConfig } = await import(pathToFileURL(swaggerConfigPath).href);
	const spec = swaggerConfig.default.definition;
	await writeFile(swaggerOutputPath, JSON.stringify(spec));

	// Copy paths
	await Promise.all([
		cp(resolve(__dirname, "src/config"), buildConfigPath, { recursive: true }),
		cp(resolve(__dirname, "src/templates/email"), emailPath, { recursive: true }),
	]);
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

function esBuildSourceMapOptions(tsConfig) {
	const { sourceMap, inlineSources, inlineSourceMap } = tsConfig.options;
	if (inlineSources && !inlineSourceMap && !sourceMap) return false;
	if (sourceMap && inlineSourceMap) return false;
	if (inlineSourceMap) return "inline";
	return sourceMap;
}

function getEsbuildMetadata(userConfig) {
	const { tsConfig, tsConfigFile } = getTSConfig(userConfig.tsConfigFile);
	const esbuildConfig = userConfig.esbuild || {};
	const outdir = esbuildConfig.outdir || tsConfig.options.outDir || "dist";
	const srcFiles = [...(esbuildConfig.entryPoints ?? []), ...tsConfig.fileNames];
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
