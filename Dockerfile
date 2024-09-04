FROM node:lts-alpine3.20 AS base
RUN ["npm", "install", "-g", "pnpm"]
WORKDIR /usr/src/app
COPY ["package*.json", "./"]
RUN ["pnpm", "import"]

FROM base AS build 
RUN ["pnpm", "install", "--frozen-lockfile"]
COPY [".", "."]
RUN ["pnpm", "run", "build"]

FROM base AS run-deps
RUN ["pnpm", "install", "--prod", "--frozen-lockfile"]


FROM node:lts-alpine3.20 AS run
WORKDIR /usr/src/app
ENV TZ="Asia/Bangkok"
RUN ["apk", "update"]
COPY --from=run-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY ["package.json", "./"]
CMD ["node", "dist/index.js"]
