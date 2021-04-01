FROM node:14-alpine
WORKDIR /usr/src/app
# This is needed to play back 
RUN apk add  --no-cache ffmpeg
COPY tsconfig.json ./
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . ./
RUN yarn build
CMD ["node", "./dist/index.js"]
