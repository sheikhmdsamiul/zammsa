import base64
import json
import logging
import os
from datetime import datetime, timezone

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_KEY_DIR = getattr(settings, 'BER_SIGNING_KEY_DIR', os.path.join(settings.BASE_DIR, 'ber_keys'))
PRIVATE_KEY_PATH = os.path.join(SYSTEM_KEY_DIR, 'ber_signing_private.pem')
PUBLIC_KEY_PATH = os.path.join(SYSTEM_KEY_DIR, 'ber_signing_public.pem')


def _ensure_key_pair():
    os.makedirs(SYSTEM_KEY_DIR, exist_ok=True)
    if os.path.exists(PRIVATE_KEY_PATH) and os.path.exists(PUBLIC_KEY_PATH):
        with open(PRIVATE_KEY_PATH, 'rb') as f:
            private_key = serialization.load_pem_private_key(f.read(), password=None)
        with open(PUBLIC_KEY_PATH, 'rb') as f:
            public_key = serialization.load_pem_public_key(f.read())
        return private_key, public_key

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()

    with open(PRIVATE_KEY_PATH, 'wb') as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    with open(PUBLIC_KEY_PATH, 'wb') as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ))

    os.chmod(PRIVATE_KEY_PATH, 0o600)
    logger.info('BER signing key pair generated at %s', SYSTEM_KEY_DIR)
    return private_key, public_key


def _get_public_key_pem():
    _, public_key = _ensure_key_pair()
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


def sign_ber_payload(member_id, member_name, role, ber_id, solicitation_id):
    private_key, public_key = _ensure_key_pair()

    payload = {
        'member_id': str(member_id),
        'member_name': member_name,
        'role': role,
        'ber_id': str(ber_id),
        'solicitation_id': str(solicitation_id),
        'signed_at': datetime.now(timezone.utc).isoformat(),
    }
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')

    signature = private_key.sign(
        payload_bytes,
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    signature_b64 = base64.b64encode(signature).decode('ascii')

    return {
        'member_id': str(member_id),
        'member_name': member_name,
        'role': role,
        'signed_at': payload['signed_at'],
        'signature': signature_b64,
        'algorithm': 'PKCS1v15-SHA256',
        'key_fingerprint': _key_fingerprint(public_key),
        'public_key_pem': _get_public_key_pem(),
    }


def _key_fingerprint(public_key):
    key_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    digest = hashes.Hash(hashes.SHA256())
    digest.update(key_bytes)
    return base64.b64encode(digest.finalize())[:24].decode('ascii')


def verify_signature(signature_data, ber_id):
    from cryptography.hazmat.primitives import serialization
    pem = signature_data.get('public_key_pem', '')
    if not pem:
        return False
    try:
        public_key = serialization.load_pem_public_key(pem.encode())
    except Exception:
        return False

    payload = {
        'member_id': signature_data['member_id'],
        'member_name': signature_data['member_name'],
        'role': signature_data['role'],
        'ber_id': str(ber_id),
        'solicitation_id': signature_data.get('solicitation_id', ''),
        'signed_at': signature_data['signed_at'],
    }
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')

    try:
        signature = base64.b64decode(signature_data['signature'])
        public_key.verify(
            signature,
            payload_bytes,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True
    except (InvalidSignature, Exception):
        return False
