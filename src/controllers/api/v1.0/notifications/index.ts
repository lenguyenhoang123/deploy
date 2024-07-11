import { Application } from "express";
import { Resource } from "express-automatic-routes";
import { Req, Res } from "#services/interfaces/iapi";
import {
	NotificationCreationAttributes,
	NotificationDocument,
	NotificationModel,
	NotificationSchema,
	// NotificationModel,
	NotificationUpdateAttributes,
} from "#models/notification";
import queryFilter from "#middlewares/query-filter";
import queryFilterRequired from "#middlewares/query-filter-required";
import BaseProvider from "#providers/baseProvider";

export default (_express: Application) => {
	const notificationProvider = new BaseProvider<NotificationModel>({
		collectionName: "notification",
		schema: NotificationSchema,
	});
	return <Resource>{
		/**
		 * @openapi
		 * tags:
		 *   name: Notification
		 *   description: Notification management
		 */
		get: {
			middleware: [queryFilter<NotificationDocument>],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /notifications:
				 *   get:
				 *     tags: [Notification]
				 *     description: Get
				 *     parameters:
				 *       - $ref: "#/components/parameters/attributes"
				 *       - $ref: "#/components/parameters/filters"
				 *       - $ref: "#/components/parameters/sortOrder"
				 *       - $ref: "#/components/parameters/sortField"
				 *       - $ref: "#/components/parameters/currentPage"
				 *       - $ref: "#/components/parameters/pageSize"
				 *     security:
				 *       - ApiKey: []
				 *     responses:
				 *       200:
				 *         description: Successfully fetched data
				 *         content:
				 *          application/json:
				 *            schema:
				 *              allOf:
				 *                - $ref: '#/components/schemas/Response'
				 *                - type: object
				 *                  properties:
				 *                    responseData:
				 *                      type: object
				 *                      properties:
				 *                        rows:
				 *                          type: array
				 *                          items:
				 *                            $ref: '#/components/schemas/Notification'
				 */

				await getAllNotification(req, res);
			},
		},

		post: {
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /notifications:
				 *   post:
				 *     tags: [Notification]
				 *     description: Post
				 *     security:
				 *       - ApiKey: []
				 *     requestBody:
				 *       content:
				 *        application/json:
				 *          schema:
				 *            type: array
				 *            items:
				 *              $ref: '#/components/schemas/NotificationCreationAttributes'
				 *     responses:
				 *       200:
				 *         description: Success
				 *         content:
				 *           application/json:
				 *            schema:
				 *              allOf:
				 *                - $ref: '#/components/schemas/Response'
				 *                - type: object
				 *                  properties:
				 *                    responseData:
				 *                      type: array
				 *                      items:
				 *                        $ref: '#/components/schemas/Notification'
				 *
				 */
				await postBulkNotification(req, res);
			},
		},

		put: {
			middleware: [queryFilter<NotificationDocument>, queryFilterRequired(["where"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /notifications:
				 *   put:
				 *     tags: [Notification]
				 *     description: Put
				 *     security:
				 *       - ApiKey: []
				 *     parameters:
				 *       - $ref: "#/components/parameters/filtersMutate"
				 *     requestBody:
				 *       content:
				 *        application/json:
				 *          schema:
				 *            $ref: '#/components/schemas/Notification'
				 *     responses:
				 *       200:
				 *         description: Success
				 *         schema:
				 *          $ref: '#/components/schemas/Response'
				 *
				 */
				await putBulkNotification(req, res);
			},
		},

		delete: {
			middleware: [queryFilter<NotificationDocument>, queryFilterRequired(["where"])],
			handler: async (req: Req, res: Res) => {
				/**
				 * @openapi
				 * /notifications:
				 *   delete:
				 *     tags: [Notification]
				 *     description: Delete
				 *     security:
				 *       - ApiKey: []
				 *     parameters:
				 *       - $ref: "#/components/parameters/filtersMutate"
				 *     responses:
				 *       200:
				 *         description: Success
				 *         schema:
				 *          $ref: '#/components/schemas/Response'
				 *
				 */
				await deleteBulkNotification(req, res);
			},
		},
	};

	async function getAllNotification(req: Req, res: Res): Promise<void> {
		try {
			const data = await notificationProvider.getAll(req.payload);
			return res.sendOk({ data });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}

	async function postBulkNotification(req: Req, res: Res): Promise<void> {
		try {
			const data = await notificationProvider.bulkCreate(
				(<NotificationCreationAttributes[]>req.body).map((body) => ({
					...body,
					created_at: new Date(),
				})),
			);
			return res.sendOk({ data });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}

	async function putBulkNotification(req: Req, res: Res): Promise<void> {
		try {
			const data = await notificationProvider.bulkUpdate(req.payload.where, <NotificationUpdateAttributes>req.body);

			return res.sendOk({ data });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}

	async function deleteBulkNotification(req: Req, res: Res): Promise<void> {
		try {
			const data = await notificationProvider.bulkDelete(req.payload.where);
			return res.sendOk({ data });
		} catch (error) {
			return res.sendError({ err: error });
		}
	}
};
