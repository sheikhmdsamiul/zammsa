FROM node:20-alpine AS build

ARG REACT_APP_API_URL=/api/v1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . ./
RUN REACT_APP_API_URL=$REACT_APP_API_URL npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
