"""Versioned bounded-memory encrypted records, backwards compatible via storage_service."""
import struct
import uuid
from app.core.security import _fernet

MAGIC = b'AYENC2\x00\x01'
BLOCK = 1024 * 1024
MAX_RECORD = 8 * 1024 * 1024


def record(data: bytes, index: int, nonce: bytes) -> bytes:
    token = _fernet().encrypt(nonce + struct.pack('>Q', index) + data)
    return struct.pack('>I', len(token)) + token


def encrypt_file(source, target):
    source.seek(0)
    nonce = uuid.uuid4().bytes
    target.write(MAGIC + nonce)
    index = 0
    while data := source.read(BLOCK):
        target.write(record(data, index, nonce))
        index += 1
    target.write(record(b'', index, nonce))  # Authenticated end marker detects truncation.
    target.flush()


def decrypted_records(source, require_final=True):
    if source.read(len(MAGIC)) != MAGIC: raise ValueError('Invalid encrypted stream')
    nonce = source.read(16)
    if len(nonce) != 16: raise ValueError('Missing file nonce')
    index = 0
    while header := source.read(4):
        if len(header) != 4: raise ValueError('Truncated record')
        length = struct.unpack('>I', header)[0]
        if not 0 < length <= MAX_RECORD: raise ValueError('Invalid record size')
        token = source.read(length)
        if len(token) != length: raise ValueError('Truncated record')
        decoded = _fernet().decrypt(token)
        if len(decoded) < 24 or decoded[:16] != nonce or struct.unpack('>Q', decoded[16:24])[0] != index: raise ValueError('Invalid record order')
        data = decoded[24:]
        if not data:
            if source.read(1): raise ValueError('Trailing record data')
            return
        yield data
        index += 1
    if require_final: raise ValueError('Missing final record')
