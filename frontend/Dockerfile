# ---- Stage 1: build the React app ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Stage 2: serve static files with Nginx ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_HOST=backend \
    BACKEND_PORT=3000
EXPOSE 80
