"""
AES-256-GCM symmetric encryption for message content.

Each message gets a unique 12-byte IV; the 16-byte auth tag is
appended to the ciphertext before hex-encoding, giving both
confidentiality and integrity in a single field.
"""
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

IV_LENGTH = 12  # bytes — recommended for GCM mode


def _get_key() -> bytes:
    return bytes.fromhex(settings.MESSAGE_ENCRYPTION_KEY)


@dataclass
class EncryptedPayload:
    ciphertext: str  # hex-encoded ciphertext + appended auth tag
    iv: str          # hex-encoded 12-byte IV


def encrypt_message(plaintext: str) -> EncryptedPayload:
    """Encrypt a plaintext string, returning (ciphertext_hex, iv_hex)."""
    iv = os.urandom(IV_LENGTH)
    aesgcm = AESGCM(_get_key())
    # AESGCM.encrypt automatically appends the 16-byte auth tag
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return EncryptedPayload(ciphertext=ciphertext.hex(), iv=iv.hex())


def decrypt_message(payload: EncryptedPayload) -> str:
    """Decrypt and verify an EncryptedPayload, returning plaintext."""
    iv = bytes.fromhex(payload.iv)
    ciphertext = bytes.fromhex(payload.ciphertext)
    aesgcm = AESGCM(_get_key())
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode("utf-8")
