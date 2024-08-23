import type { Options } from "swagger-jsdoc";
import { resolve } from "path";
import { root } from "../../root";
import nconf from "nconf";

export default {
	definition: {
		openapi: "3.1.0",
		info: {
			version: "1.0.0",
			title: "SHTT",
			description: "Coded by Meu TEAM",
		},
		consumes: ["application/json", "application/x-www-form-urlencoded"],
		servers: [
			{ url: "https://gateway.dev.meu-solutions.com/shtt/api/v1.0" },
			{ url: "http://localhost:3000/api/v1.0" },
		],
		components: {
			securitySchemes: {
				Bearer: {
					name: "Authorization",
					in: "header",
					type: "apiKey",
					description: "Usage: Bearer $token",
				},
			},
			parameters: {
				// Fetch queries
				filters: {
					name: "filters",
					in: "query",
					description: "filter, visit https://www.npmjs.com/package/sequelize-api-paginate for syntax",
					type: "string",
				},
				sortField: {
					name: "sortField",
					in: "query",
					description: "sortField, visit https://www.npmjs.com/package/sequelize-api-paginate for syntax",
					type: "string",
				},
				sortOrder: {
					name: "sortOrder",
					in: "query",
					description: "sort order, visit https://www.npmjs.com/package/sequelize-api-paginate for syntax",
					type: "string",
				},
				currentPage: {
					name: "currentPage",
					in: "query",
					description: "currentPage, visit https://www.npmjs.com/package/sequelize-api-paginate for syntax",
					type: "integer",
				},
				pageSize: {
					name: "pageSize",
					in: "query",
					description: "pageSize, visit https://www.npmjs.com/package/sequelize-api-paginate for syntax",
					type: "number",
				},
				// Mutate queries
				filtersMutate: {
					name: "filters",
					in: "query",
					description: "filter, visit https://www.npmjs.com/package/sequelize-api-paginate for syntax",
					type: "string",
					required: true,
				},
			},
			schemas: {
				// RESPONSE SECTION
				Response: {
					type: "object",
					properties: {
						message: {
							type: "string",
						},
						message_en: {
							type: "string",
						},
						responseData: {
							type: "object",
						},
						status: {
							type: "string",
							example: "success | fail",
						},
						timeStamp: {
							type: "string",
							example: "2024-02-26 03:12:45",
						},
						violation: {
							type: "array",
							items: {
								type: "object",
							},
						},
					},
				},
				responseGetAllData: {
					allOf: [
						{ $ref: "#/components/schemas/Response" },
						{
							type: "object",
							properties: {
								responseData: {
									type: "object",
									properties: {
										totalPages: {
											type: "number",
										},
										currentPage: {
											type: "number",
										},
										count: {
											type: "number",
										},
										rows: {
											type: "array",
											items: {
												type: "object",
											},
										},
									},
								},
							},
						},
					],
				},
				// END RESPONSE SECTION

				// USER SECTION
				userMutate: {
					type: "object",
					properties: {
						first_name: { type: "string" },
						middle_name: { type: "string" },
						last_name: { type: "string" },
						email: { type: "string" },
						phone: { type: "string" },
						unit: {
							type: "object",
							properties: {
								district: { type: "string" },
								ward: { type: "string" },
							},
						},
					},
				},
				updateUserInfo: {
					type: "object",
					properties: {
						first_name: { type: "string" },
						middle_name: { type: "string" },
						last_name: { type: "string" },
						unit: {
							type: "object",
							properties: {
								district: { type: "string" },
								ward: { type: "string" },
							},
						},
					},
				},
				userRegister: {
					allOf: [
						{
							$ref: "#/components/schemas/userMutate",
						},
						{ type: "object", properties: { password: { type: "string" } } },
					],
				},
				User: {
					allOf: [
						{
							$ref: "#/components/schemas/userMutate",
						},
						{
							type: "object",
							properties: {
								is_admin: { type: "boolean" },
								is_active: { type: "boolean" },
								is_deleted: { type: "boolean" },
								created_at: { type: "string" },
								created_by: { type: "string" },
								updated_at: { type: "string" },
								updated_by: { type: "string" },
							},
						},
					],
				},

				// QUESTION BANK SECTION
				Answer: {
					type: "object",
					properties: {
						value: { type: "string" },
						is_correct: { type: "boolean" },
					},
				},

				QuestionBankMutate: {
					type: "object",
					properties: {
						name: { type: "string" },
						level: { type: "string", enum: ["EASY", "NORMAL", "HARD"] },
						priority: { type: "number" },
						answers: {
							type: "array",
							items: {
								$ref: "#/components/schemas/Answer",
							},
						},
					},
				},

				QuestionBank: {
					allOf: [
						{
							$ref: "#/components/schemas/QuestionBankMutate",
						},
						{
							type: "object",
							properties: {
								created_at: { type: "string", format: "date-time" },
								created_by: { type: "string", format: "uuid" },
								updated_at: { type: "string", format: "date-time" },
								updated_by: { type: "string", format: "uuid" },
							},
						},
					],
				},

				// EXAM SECTION
				Template: {
					type: "object",
					properties: {
						name: { type: "string" },
						questions: {
							type: "array",
							items: { $ref: "#/components/schemas/QuestionBank" },
						},
					},
				},

				ParticipantAnswers: {
					type: "object",
					properties: {
						question_id: { type: "string", format: "uuid" },
						user_answer: { type: "string", format: "uuid" },
						question_answers: {
							type: "array",
							items: {
								type: "string",
								format: "uuid",
							},
						},
					},
				},

				SubmitParticipantAnswers: {
					type: "object",
					properties: {
						start_time: { type: "string", format: "date-time" },
						submit_time: { type: "string", format: "date-time" },
						answers: {
							type: "array",
							items: { $ref: "#/components/schemas/ParticipantAnswers" },
						},
					},
				},

				Participant: {
					type: "object",
					properties: {
						user_id: { type: "string", format: "uuid" },
						start_time: { type: "string", format: "date-time" },
						submit_time: { type: "string", format: "date-time" },
						answers: {
							type: "array",
							items: { $ref: "#/components/schemas/ParticipantAnswers" },
						},
					},
				},

				ExamMutate: {
					type: "object",
					properties: {
						name: { type: "string" },
						description: { type: "string" },
						start_time: { type: "string", format: "date-time" },
						end_time: { type: "string", format: "date-time" },
						allowed_time: { type: "number" },
						template: {
							type: "object",
							items: { $ref: "#/components/schemas/Template" },
						},
						participants: {
							type: "array",
							items: { $ref: "#/components/schemas/Participant" },
						},
					},
				},

				Exam: {
					allOf: [
						{
							$ref: "#/components/schemas/ExamMutate",
						},
						{
							type: "object",
							properties: {
								created_at: { type: "string", format: "date-time" },
								created_by: { type: "string", format: "uuid" },
								updated_at: { type: "string", format: "date-time" },
								updated_by: { type: "string", format: "uuid" },
							},
						},
					],
				},
			},
		},
	},
	apis: [resolve(root, "src/controllers/api/v1.0/**/*.*")],
} satisfies Options;
