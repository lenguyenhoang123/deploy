import BaseProvider from "#templates/base/baseProvider";
import { IWebsiteConfig, IWebsiteConfigMethods, collectionName, schema } from "#models/websiteConfig";

export class WebsiteConfigProvider extends BaseProvider<IWebsiteConfig, IWebsiteConfigMethods> {
	constructor() {
		super({ collectionName, schema });
	}
}
