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
import { configPath } from "./root";
import nconf from "nconf";
import constants from "./constants";
// Middlewares & Schedulers
import verify from "./middlewares/auth";
import response from "./middlewares/response";
// Swagger
import swaggerUI from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerConfig from "./templates/swagger/config";
import { mkdirSync, writeFileSync } from "fs";

const // Swagger functions
	// Serve Swagger to web
	generateSwaggerModels = (config: typeof swaggerConfig) => {
		return config;
	},
	// Generate swagger output
	generateSwagger = async (storagePath: string) => {
		try {
			const spec = swaggerJSDoc(generateSwaggerModels(swaggerConfig));
			const swaggerServePath = `${storagePath}/swagger/`;
			mkdirSync(swaggerServePath, { recursive: true });
			writeFileSync(`${swaggerServePath}/swagger-output.json`, JSON.stringify(spec));
			return;
		} catch (error) {
			throw Error;
		}
	}, // Serve Swagger to web
	serveSwagger = async (app: Application, storagePath: string) => {
		const doc = require(`${storagePath}/swagger/swagger-output.json`);

		app.use(constants.SWAGGER_ROUTER, swaggerUI.serve, swaggerUI.setup(doc));
	};

const // Server functions
	serverLog = (content: string) => console.log(`${clc.magenta("⚡️[server]:")} ${content}`),
	initServer = async (storagePath: string, env: "development" | "staging" | "production") => {
		const // Setup constant
			app: Application = express(),
			corsOptions = (
				env == "development"
					? undefined
					: {
							origin(origin, callback) {
								const whitelist =
									env == "production"
										? ["https://9mb.vn"]
										: [
												"http://localhost:3000",
												"http://localhost:3001",
												"https://saigon-business.erp.meu-solutions.com",
										  ];
								callback(null, whitelist.indexOf(origin) !== -1);
							},
					  }
			) satisfies CorsOptions;
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
			serverPath: string = nconf.get("backEndHost"),
			serverHost: string = (env == "development" ? "http://" : "https://") + serverPath,
			storagePath: string = resolve(global.__baseDir, "storage");
		// Generate swagger output
		await generateSwagger(storagePath);
		// Generate swagger output
		switch (env.toLowerCase()) {
			case "development":
				return await startDevServer(storagePath, serverPath, serverHost, port);
			default:
				return await startProductionServer(
					storagePath,
					serverPath,
					serverHost,
					port,
					env.toLowerCase() as "staging" | "production",
				);
		}
	},
	startDevServer = async (storagePath: string, serverPath: string, serverHost: string, port: number) => {
		const app = await initServer(storagePath, "development");
		// Create swagger for development and staging
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
		serverPath: string,
		serverHost: string,
		port: number,
		env: "staging" | "production",
	) => {
		if (cluster.isPrimary) {
			const cores = cpus().length;

			console.log(`Total cores: ${clc.greenBright(cores)}`);
			console.log(`Primary process ${clc.bgGreenBright(process.pid)} is running`);

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
		const app = await initServer(storagePath, env);
		app.listen(port, () => {
			serverLog(`Server started with worker ${clc.bgCyanBright(process.pid)}`);
		});
		if (env == "staging") serveSwagger(app, storagePath);
		return;
	};

export { startServer, serverLog };
