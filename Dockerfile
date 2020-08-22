FROM node:10-alpine AS media-sync

RUN mkdir -p /home/node/app/node_modules/ && chown -R node:node /home/node/app

WORKDIR /home/node/app
COPY ./ /home/node/app

RUN npm install

CMD [ "/bin/sh", "./start.sh" ]
