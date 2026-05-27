FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 go build -o /matchmaker .

FROM nats:2.10.26-alpine AS nats

FROM alpine:3.19
RUN apk add --no-cache ca-certificates netcat-openbsd
COPY --from=nats /usr/local/bin/nats-server /usr/local/bin/nats-server
COPY --from=builder /matchmaker /matchmaker
COPY backend/start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 8080
CMD ["/start.sh"]
