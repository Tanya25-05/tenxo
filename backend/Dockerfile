FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /matchmaker .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates netcat-openbsd
ADD https://github.com/nats-io/nats-server/releases/download/v2.10.26/nats-server-v2.10.26-linux-amd64.tar.gz /tmp/nats.tar.gz
RUN tar -xzf /tmp/nats.tar.gz -C /usr/local/bin --strip-components=1 && rm /tmp/nats.tar.gz
COPY --from=builder /matchmaker /matchmaker
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 8080
CMD ["/start.sh"]
