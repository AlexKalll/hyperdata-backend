#!/bin/sh
set -eu

alias_name="local"
policy_name="${MINIO_BUCKET}-rw"
policy_file="/tmp/${policy_name}.json"

mc_bin="$(command -v mc || true)"
if [ -z "${mc_bin}" ]; then
  echo "mc binary was not found on PATH in the MinIO client image." >&2
  exit 1
fi

if [ "${MINIO_ACCESS_KEY}" = "${MINIO_ROOT_USER}" ]; then
  echo "MINIO_ACCESS_KEY must be different from MINIO_ROOT_USER." >&2
  exit 1
fi

"${mc_bin}" alias set "${alias_name}" http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"
"${mc_bin}" mb --ignore-existing "${alias_name}/${MINIO_BUCKET}"

cat > "${policy_file}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetBucketLocation",
        "s3:ListBucket",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": [
        "arn:aws:s3:::${MINIO_BUCKET}"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:AbortMultipartUpload",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:ListMultipartUploadParts",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::${MINIO_BUCKET}/*"
      ]
    }
  ]
}
EOF

if ! "${mc_bin}" admin policy info "${alias_name}" "${policy_name}" >/dev/null 2>&1; then
  "${mc_bin}" admin policy create "${alias_name}" "${policy_name}" "${policy_file}"
fi

if ! "${mc_bin}" admin user info "${alias_name}" "${MINIO_ACCESS_KEY}" >/dev/null 2>&1; then
  "${mc_bin}" admin user add "${alias_name}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"
fi

"${mc_bin}" admin policy attach "${alias_name}" "${policy_name}" --user "${MINIO_ACCESS_KEY}"
"${mc_bin}" anonymous set none "${alias_name}/${MINIO_BUCKET}"
