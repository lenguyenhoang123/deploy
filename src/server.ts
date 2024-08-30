// Express Base
import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import autoroutes from "express-automatic-routes";
import compression from "compression";
import bodyParser from "body-parser";
// Server-Hardware interactions
import clc from "cli-color";
import cluster, { Worker } from "cluster";
import { cpus } from "os";
import { resolve } from "path";
// Environments & Constansts
import { Environment } from "./services/interfaces/ienv";
import { configPath, root } from "./root";
import nconf, { Provider } from "nconf";
import constants from "./constants";
// Middlewares & Schedulers
import verify from "./middlewares/auth";
import response from "./middlewares/response";
// Swagger
import swaggerUI from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { promisify } from "util";
import mv from "mv";
const moveAsync = promisify<string, string, mv.Options>(mv);

const // Swagger functions
	// Generate swagger output
	generateSwagger = async (storagePath: string) => {
		const swaggerConfig = require("./templates/swagger/config").default;
		const spec = swaggerJSDoc(swaggerConfig);
		const swaggerServePath = `${storagePath}/swagger/`;
		mkdirSync(swaggerServePath, { recursive: true });
		writeFileSync(`${swaggerServePath}/swagger-output.json`, JSON.stringify(spec));
		return;
	}, // Serve Swagger to web
	serveSwagger = async (app: Application, storagePath: string) => {
		const doc = require(`${storagePath}/swagger/swagger-output.json`);

		app.use(constants.SWAGGER_ROUTER, swaggerUI.serve, swaggerUI.setup(doc));
	};

const // Server functions
	serverLog = (content: string) => console.log(`${clc.magenta("⚡️[server]:")} ${content}`),
	initServer = async (storagePath: string, env: "development" | "staging" | "production", nconf: Provider) => {
		const // Setup constant
			app: Application = express(),
			corsOptions = (function (env: "development" | "staging" | "production", nconf: Provider) {
				if (env === "development") return undefined;
				return {
					origin(origin, callback) {
						callback(null, nconf.get("Domains:Frontend").indexOf(origin) !== -1);
					},
				};
			})(env, nconf) satisfies CorsOptions;
		// Basic server requirements
		app.use(compression());
		app.use(bodyParser.json({ type: "application/json" }));

		// Middlewares
		app.use(response);

		// Auto import controllers with express-automatic-routes
		app.all("/api/*", cors(corsOptions));
		autoroutes(app, { dir: `./controllers/`, log: env == "development" });
		// Public folder
		app.all("/logs/*", verify);
		app.use(
			express.static(storagePath, {
				maxAge: 31536000, // 1Y
				immutable: true,
			}),
		);
		return app;
	},
	startServer = async (env: Environment) => {
		nconf.argv().env().file({
			file: configPath,
		});

		const // Path
			port: number = nconf.get("Port"),
			serverHost: string = nconf.get("Domains:Backend")[0],
			storagePath: string = resolve(root, "storage");
		// Generate swagger output
		switch (env.toLowerCase()) {
			case "development":
				return await startDevServer(storagePath, nconf, serverHost, port);
			default:
				return await startProductionServer(
					storagePath,
					nconf,
					serverHost,
					port,
					env.toLowerCase() as "staging" | "production",
				);
		}
	},
	startDevServer = async (storagePath: string, nconf: Provider, serverHost: string, port: number) => {
		const app = await initServer(storagePath, "development", nconf);
		// Generate swagger output

		await generateSwagger(storagePath);
		serveSwagger(app, storagePath);

		serverLog(`Serving static files from ${clc.blueBright(storagePath)}`);
		serverLog(`App will be served at ${clc.blueBright(serverHost)}`);

		app.listen(port, () => {
			serverLog(`Server started with worker ${clc.bgCyanBright(process.pid)}`);
		});
		return;
	},
	startProductionServer = async (
		storagePath: string,
		nconf: Provider,
		serverHost: string,
		port: number,
		env: "staging" | "production",
	) => {
		if (cluster.isPrimary) {
			const cores = cpus().length;

			console.log(`Total cores: ${clc.greenBright(cores)}`);
			console.log(`Primary process ${clc.bgGreenBright(process.pid)} is running`);

			await generateSwagger(storagePath);

			// const newGenSwaggerPath = resolve(root, "dist/templates/swagger/swagger-output.json");
			// if (existsSync(newGenSwaggerPath))
			// 	await moveAsync(newGenSwaggerPath, resolve(storagePath, "swagger/swagger-output.json"), { mkdirp: true });

			for (let i = 0; i < cores; i++) cluster.fork();

			cluster.on("exit", (worker: Worker, code: number) => {
				console.log(`Worker ${worker.process.pid} exited with code ${code}`);
				console.log("Fork new worker!");
				cluster.fork();
			});

			serverLog(`Serving static files from ${clc.blueBright(storagePath)}`);
			serverLog(`App will be served at ${clc.blueBright(serverHost)}\n`);
			return;
		}
		const app = await initServer(storagePath, env, nconf);
		app.listen(port, () => {
			serverLog(`Server started with worker ${clc.bgCyanBright(process.pid)}`);
		});
		if (env == "staging") serveSwagger(app, storagePath);
		return;
	};

export { startServer, serverLog };
