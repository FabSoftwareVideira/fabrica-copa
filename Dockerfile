# ------------------------------------------------------------
# BACKEND DEV
# ------------------------------------------------------------
FROM node:22-bookworm-slim AS backend-dev

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY frontend/js/data.js /app/frontend/js/data.js

EXPOSE 3001
CMD ["npm", "run", "dev"]

# ------------------------------------------------------------
# BACKEND PROD
# ------------------------------------------------------------
FROM node:22-bookworm-slim AS backend-prod

ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY frontend/js/data.js /app/frontend/js/data.js

EXPOSE 3001
CMD ["npm", "start"]

# ------------------------------------------------------------
# FRONTEND DEV
# ------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-dev

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ------------------------------------------------------------
# FRONTEND BUILD (PROD)
# ------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_BASE_PATH=/copa/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

RUN npm run build

# ------------------------------------------------------------
# FRONTEND PROD (NGINX)
# ------------------------------------------------------------
FROM nginx:1.27-alpine AS frontend-prod

COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
