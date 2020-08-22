FROM node:10-alpine AS lotus-eaters-app

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app
COPY site/ /home/node/app
COPY core/ /home/node/core

RUN apk add g++ make python && npm install node-gyp -g && npm install

CMD [ "/bin/sh", "./start.sh", "--docker" ]

FROM node:10-alpine AS lotus-eaters-worker

RUN mkdir -p /home/node/app/node_modules/ && chown -R node:node /home/node/app

WORKDIR /home/node/app
COPY worker/ /home/node/app
COPY core/ /home/node/core

RUN npm install

CMD [ "/bin/sh", "./start.sh" ]

FROM node:10-alpine AS lotus-eaters-admin

RUN mkdir -p /home/node/app/node_modules/ && chown -R node:node /home/node/app

WORKDIR /home/node/app
COPY admin/ /home/node/app
COPY core/ /home/node/core

RUN npm install

CMD [ "/bin/sh", "./start.sh" ]
