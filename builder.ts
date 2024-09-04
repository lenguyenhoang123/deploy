// Builder reqs
import { build, BuildOptions } from "esbuild";
import { sys, readConfigFile, findConfigFile, parseJsonConfigFileContent } from "typescript";

// Prebuild reqs
import { resolve } from "path";
import { mkdir, rm, cp } from "fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerConfig from "./src/templates/swagger/config";

const cwd = process.cwd();
console.time("Built time");
(async function () {
	const { esbuildOptions } = getEsbuildMetadata({ esbuild: { minify: true } });
	const buildPath = resolve(__dirname, "dist");
	const templatePath = resolve(buildPath, "templates");
	const buildConfigPath = resolve(buildPath, "config");
	const emailPath = resolve(templatePath, "email");

	// Pre build functions here
	if (existsSync(buildPath)) await rm(buildPath, { recursive: true });
	await mkdir(buildPath);

	await generateSwagger(templatePath);

	// Builder
	await build({
		bundle: false,
		format: "cjs",
		platform: "node",
		...esbuildOptions,
	});

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

// Generate swagger output
async function generateSwagger(storagePath: string) {
	const spec = swaggerJSDoc(swaggerConfig);
	const swaggerServePath = `${storagePath}/swagger/`;
	mkdirSync(swaggerServePath, { recursive: true });
	writeFileSync(`${swaggerServePath}/swagger-output.json`, JSON.stringify(spec));
	return;
}
