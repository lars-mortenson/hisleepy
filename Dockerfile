FROM node:14-alpine
RUN apk update
RUN apk add make py3-pip build-base
# Create a group and user
RUN addgroup -S hisleepygroup && adduser -S hisleepyuser -G hisleepygroup
USER hisleepyuser
WORKDIR /usr/src/app
COPY tsconfig.json ./
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . ./
RUN yarn build
CMD ["node", "./dist/index.js"]
