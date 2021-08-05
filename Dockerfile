FROM node:latest as build
WORKDIR /app
COPY / ./
COPY package*.json ./

RUN npm install && npm run build
COPY . .


FROM nginx:1.17.1-alpine
WORKDIR /app
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/lunr /usr/share/nginx/html