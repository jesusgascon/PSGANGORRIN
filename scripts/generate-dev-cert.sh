#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-localhost}"
CERT_DIR="certs"
KEY_FILE="${CERT_DIR}/dev-key.pem"
CERT_FILE="${CERT_DIR}/dev-cert.pem"
CONFIG_FILE="${CERT_DIR}/openssl-dev.cnf"

mkdir -p "${CERT_DIR}"

if [[ "${HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  HOST_SAN="IP.2 = ${HOST}"
  HOST_CN="${HOST}"
else
  HOST_SAN="DNS.2 = ${HOST}"
  HOST_CN="${HOST}"
fi

cat > "${CONFIG_FILE}" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = ${HOST_CN}

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
${HOST_SAN}
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -config "${CONFIG_FILE}"

echo "Certificado generado:"
echo "  ${CERT_FILE}"
echo "  ${KEY_FILE}"
