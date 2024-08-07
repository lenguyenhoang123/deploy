import dayjs from "dayjs";
import { FilterQuery } from "mongoose";
const dictOperators = [
	{ operator: "==", meaning: "Equals" },
	{ operator: "!=", meaning: "Not equals" },
	{ operator: ">=", meaning: "Greater than or equal to" },
	{ operator: "<=", meaning: "Less than or equal to" },
	{ operator: ">", meaning: "Greater than" },
	{ operator: "<", meaning: "Less than" },
	{ operator: "@=", meaning: "Contains" },
	{ operator: "_=", meaning: "Starts with" },
	{ operator: "!@=", meaning: "Does not Contains" },
	{ operator: "!_=", meaning: "Does not Starts with" },
	{ operator: "[]", meaning: "Only datetime, date between two date" },
];

const listOperators = dictOperators.map(({ operator }) => operator);

function generateConditionExtra(params: string): any {
	try {
		const character = listOperators.find((el) => params.includes(el)) || "";
		const arrLeftRight = params.split(character);
		arrLeftRight[0] = arrLeftRight[0].trim();
		arrLeftRight[1] = arrLeftRight[1].trim();
		if (!arrLeftRight[1]) return null;
		const conditionRight =
			character !== "[]" ? arrLeftRight[1].replace("(", "").replace(")", "").split("|") : [arrLeftRight[1]];

		const conditionReturn: any[] = [];
		let arr: string[] = [];
		if (arrLeftRight[0].includes("|")) {
			const str = getBetweenCondition(arrLeftRight[0]);
			arr = str.split("|");
		} else {
			arr.push(arrLeftRight[0]);
		}
		for (const element of arr) {
			for (const right of conditionRight) {
				const arrAppend = [element.trim(), right.trim()];
				const obj = genCondition(arrAppend, character);
				conditionReturn.push(obj);
			}
		}
		return conditionReturn;
	} catch (ex) {
		throw ex;
	}
}

function getBetweenCondition(str: string): string {
	return str
		.substring(
			str.indexOf("(") !== -1 ? str.indexOf("(") + 1 : 0,
			str.indexOf(")") !== -1 ? str.indexOf(")") : str.length,
		)
		.trim();
}

function generateCondition(params: string): Promise<any> {
	try {
		const character = listOperators.find((el) => params.includes(el)) || "";
		const arrLeftRight = params.split(character);
		arrLeftRight[0] = arrLeftRight[0].trim();
		arrLeftRight[1] = arrLeftRight[1].trim();
		if (!arrLeftRight[1]) return null;

		const conditionReturn = genCondition(arrLeftRight, character);
		return conditionReturn;
	} catch (ex) {
		throw ex;
	}
}

function genCondition(arrLeftRight: string[], character: string): any {
	let [conditionLeft, conditionRight] = arrLeftRight;
	if (conditionRight === "null") {
		conditionRight = null;
	}

	switch (character) {
		case "==":
			return { [conditionLeft]: conditionRight };
		case "!=":
			return { [conditionLeft]: { $ne: conditionRight } };
		case ">=":
			return { [conditionLeft]: { $gte: conditionRight } };
		case "<=":
			return { [conditionLeft]: { $lte: conditionRight } };
		case ">":
			return { [conditionLeft]: { $gt: conditionRight } };
		case "<":
			return { [conditionLeft]: { $lt: conditionRight } };
		case "@=":
			return { [conditionLeft]: { $regex: `.*${conditionRight}.*` } };
		case "_=":
			return { [conditionLeft]: { $regex: `${conditionRight}.*` } };
		case "!@=":
			return { [conditionLeft]: { $not: { $regex: `.*${conditionRight}.*` } } };
		case "!_=":
			return { [conditionLeft]: { $not: { $regex: `${conditionRight}.*` } } };
		case "[]":
			const valSearch = getBetweenCondition(conditionRight);
			const arrStartEnd = valSearch.split("&");
			const start = dayjs(`${arrStartEnd[0]} 00:00:00`, ["YYYY", "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"], true).toString();
			const end = dayjs(`${arrStartEnd[1]} 23:59:59`, ["YYYY", "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"], true).toString();

			return {
				$and: [{ [conditionLeft]: { $gte: start } }, { [conditionLeft]: { $lte: end } }],
			};
		default:
			throw new Error("Invalid operator format");
	}
}

function getCorrectFormatTime(value: string): string | null {
	const arrayFormat = ["yyyy/MM/dd", "yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd"];
	for (const element of arrayFormat) {
		if (dayjs(value, element)) return element;
	}
	return null;
}

export function modifyFilterString<T = unknown>(filter: string): FilterQuery<T> {
	let indexOp = 0;

	const filterString = filter;
	const arrFilters = filterString ? filterString.split(",") : [];
	const conditionCheckedChild: any[] = [];

	for (const element of arrFilters) {
		if (element.includes("|")) {
			const objCondition = generateConditionExtra(element);
			if (!objCondition) continue;

			const conditionNotOr = { $or: objCondition };
			conditionCheckedChild.push(conditionNotOr);
		} else {
			const conditionNotOr = generateCondition(element);
			if (!conditionNotOr) continue;

			conditionCheckedChild.push(conditionNotOr);
		}
		indexOp++;
	}
	const condition = conditionCheckedChild.length > 1 ? { $and: conditionCheckedChild } : conditionCheckedChild[0];

	return conditionCheckedChild.length ? condition : {};
}
