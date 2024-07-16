import type { Environment } from "./services/interfaces/ienv";
import { startServer } from "./server";

import moduleAlias from "module-alias";
Error.stackTraceLimit = Infinity;

moduleAlias.addAliases({
	"#providers": __dirname + "/providers",
	"#services": __dirname + "/services",
	"#middlewares": __dirname + "/middlewares",
	"#models": __dirname + "/models",
	"#templates": __dirname + "/templates",
	"#constants": __dirname + "/constants",
	"#dto": __dirname + "/dto",
	"#": __dirname,
});
moduleAlias();
startServer(<Environment>process.env.NODE_ENV).catch((err) => {
	console.log(err);
});
