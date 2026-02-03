FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_BACKEND_BASE_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_BACKEND_BASE_URL=$VITE_BACKEND_BASE_URL
RUN npm run build
CMD ["sh","-c","cp -r /app/dist/* /out/ && tail -f /dev/null"]
