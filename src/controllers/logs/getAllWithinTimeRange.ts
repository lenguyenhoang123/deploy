import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { existsSync, lstatSync, readdirSync, readFileSync } from "fs";
import { Req, Res } from "#services/interfaces/iapi";
import { resolve } from "path";
import verify from "#middlewares/auth";
import dayjs from "dayjs";

export default (_express: Application) => {
	return <Resource>{
		get: {
			middleware: [verify],
			handler: (req: Req, res: Res) => {
				/* 
          Query:
            - fromDate: 
            - toDate:
          Date Format: dd-mm-yyyy
        */

				try {
					const data: Record<string, Record<string, Record<string, string>>> = {};
					const dateFormat = "dd-mm-yyyy";
					const baseLogPath = resolve(global.__baseDir.replace("dist"), "storage/logs");
					const // Time range
						from = dayjs(<string>req.query.fromDate, dateFormat).isValid()
							? dayjs(<string>req.query.fromDate, dateFormat).startOf("day")
							: dayjs().startOf("day"),
						to = dayjs(<string>req.query.toDate, dateFormat).isValid()
							? dayjs(<string>req.query.toDate, dateFormat).endOf("day")
							: dayjs().endOf("day");

					const recursiveCheckLogFolders = (folder: string, from: dayjs.Dayjs, to: dayjs.Dayjs) => {
						// Check if path exists
						if (!existsSync(folder)) return;
						// Check if path is a file
						if (lstatSync(folder).isFile()) {
							const relativePath = folder.replace(baseLogPath + "/", "").split("/");
							const // keys
								key = relativePath.pop().replace(/\.((log)|(txt))/, ""),
								source = relativePath.length == 1 ? "apis" : relativePath[0],
								date = relativePath[relativePath.length - 1];
							if (!data[source]) {
								data[source] = {
									[date]: { [key]: readFileSync(folder, "utf-8") },
								};
								return;
							}
							if (!data[source][date]) {
								data[source][date] = {
									[key]: readFileSync(folder, "utf-8"),
								};
								return;
							}
							if (typeof data[source][date][key] == "undefined")
								data[source][date][key] = readFileSync(folder, "utf-8");
							else data[source][date][key] += readFileSync(folder, "utf-8");
							return;
						}
						// Path is a directory
						readdirSync(folder).forEach((path) => {
							const pathTime = dayjs(path, "ddmmyyyy");
							if (pathTime.isValid() && (pathTime.isBefore(from) || pathTime.isAfter(to))) return;
							recursiveCheckLogFolders(`${folder}/${path}`, from, to);
						});
					};

					recursiveCheckLogFolders(baseLogPath, from, to);
					return res.sendOk({ data: data });
				} catch (error) {
					return res.sendError({ err: error });
				}
			},
		},
	};
};
