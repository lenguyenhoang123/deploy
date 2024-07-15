export function capitalizeFirstLetter(string: string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getBoolean(value: unknown) {
	switch (value) {
		case true:
		case "true":
		case 1:
		case "1":
		case "on":
		case "yes":
			return true;
		default:
			return false;
	}
}
