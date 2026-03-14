FROM alpine:3.19

# Install: postgresql-client (pg_dump), gnupg (GPG encryption), rclone (B2 upload)
RUN apk add --no-cache \
    postgresql16-client \
    gnupg \
    curl \
    dcron \
    tzdata

# Install rclone
RUN curl -sL https://rclone.org/install.sh | sh

WORKDIR /backup

COPY backup.sh ./backup.sh
COPY entrypoint.sh ./entrypoint.sh
COPY rclone.conf.template ./rclone.conf.template

RUN chmod +x backup.sh entrypoint.sh

ENTRYPOINT ["/backup/entrypoint.sh"]
