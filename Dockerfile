# STAGE 1: BUILD
FROM node:current-bookworm as build
ARG NODE_ENV
ENV NODE_ENV "$NODE_ENV"
WORKDIR /usr/src/app
RUN ["chmod", "1777", "/tmp"]
RUN ["mkdir", "/data"]
COPY ["package*.json", "./"]
RUN ["npm", "install"]
COPY [".", "."]
RUN ["npm", "run", "build"]
RUN ["/bin/bash", "-c", "find . ! -name dist ! -name .env  -maxdepth 1 -mindepth 1 -exec rm -rf {} \\;"]

# STAGE 2: RUN
FROM node:current-alpine3.19 as run
WORKDIR /usr/src/app
ENV TZ="Asia/Bangkok"
RUN ["apk", "update"]
RUN ["apk", "add", "ffmpeg"]
COPY ["package*.json", "./"]
RUN ["npm", "install", "--omit=dev"]
COPY --from=build /usr/src/app ./
CMD ["npm", "start"]
