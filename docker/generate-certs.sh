#!/bin/bash
# Generate self-signed SSL certificates for local development

set -e

CERT_DIR="./certs"
mkdir -p $CERT_DIR

if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
    echo "Generating self-signed SSL certificates..."
    openssl req -x509 -newkey rsa:4096 -nodes \
        -out $CERT_DIR/cert.pem \
        -keyout $CERT_DIR/key.pem \
        -days 365 \
        -subj "/C=US/ST=State/L=City/O=Conexus/CN=localhost"
    echo "✓ SSL certificates generated successfully"
else
    echo "✓ SSL certificates already exist"
fi
