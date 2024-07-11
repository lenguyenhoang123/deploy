# Backend Template - Typescript - Node.JS

This is a backend template

Project by: MeU Team

## Table of contents

1. Techonologies
2. Project Struture
3. Workflow

## 1. Technologies

The following technologies are used in the project:

1. ***Language***: Typescript -> Javascript
2. ***Environment***: Node.JS
3. ***Database***: PostgreSQL
4. ***Framework***: Express
   * API Documentaton: Swagger - OpenAPI 3.1
   * API Routing: express-automatic-routes
   * Builder: esbuild
   * ORM: Sequelize
   * API Query Handler: sequelize-api-paginate
   * Scheduler | CronJobs: node-schedule
   * Mail system: nodemailer
   * Media compression: ffmpeg
     * Image compression via sharp
   * Authentication: jsonwebtoken
   * Encryption: cryptojs & bcryptjs
   * File upload: multer
   * Validator field: express-validator

## 2. Project Structure

```text
root/
├── generator/
│   ├── templates/
│   │   ├── controllerAllPath.mustache        // basic api all records path
│   │   ├── controllerIdPath.mustache         // basic api record id path
│   │   └── provider.mustache                 // basic provider 
│   └── index.ts                              // generator entry point
├── src/
│   ├── config                                // place environment's specific configurations here
│   ├── constants                             // environment's agonistic constants
│   ├── controllers/
│   │   ├── api                               // api routing here
│   │   └── logs                              // for fetching server logs
│   ├── dto
│   ├── middlewares
│   ├── models                                // database dto here, usually auto-generated
│   ├── providers
│   ├── services
│   ├── templates/
│   │   └── swagger-template.json             // template used for swaggerJsDoc here
│   ├── index.ts                              // project's main entry point!
│   └── server.ts                             // swagger & server's startup functions.
├── .env
└── storage/
    ├── images
    └── swagger/
        └── swagger-output.json               // generated at runtime
```

## 3. Workflow

1. Dev should read and analyze the assigned ticket, either via Jira or by an organized sheet
2. Dev should check if the model required for the ticket is available in "models"
   1. If available, proceed to the next step
   2. If not, run the following command: `npm run genDb`
3. Dev should check if the api path required for the ticket is available in "controllers"
   1. If available, proceed to handling the required path
   2. If the path is either "/" or "/{id}":
      * We can auto generate said paths with the following command: `npm run genApiModule`
      * The command will first ask for Dev to enter the correct model from the folder "models". THIS IS REQUIRED
      * It will then ask for the prefered API link. THIS IS REQUIRED.
      * It will then ask for the prefered Swagger Tag. THIS IS OPTIONAL.
      * Finally, it will create 2 files in the folder from the prefered API Link entered above, named "index.ts" & "{id}.ts"
