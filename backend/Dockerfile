FROM golang:1.24-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /matchmaker .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /matchmaker .
COPY configs/nats.conf /etc/nats/nats-server.conf
EXPOSE 8080
CMD ["./matchmaker"]
