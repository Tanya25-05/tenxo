"""
Tenxo — Zero-Knowledge Decentralized GPU Grid CLI.

Core cryptographic primitives for the zero-trust execution protocol:
  - X25519 ECDH ephemeral key exchange
  - AMD SEV-SNP TEE attestation verification
  - HKDF-derived AES-256-GCM payload encryption
  - Plausible deniability through uniform payload padding

Security model:
  - The matchmaker routes only public keys and TEE quotes
  - The ECDH shared secret and AES payload key NEVER leave the client/agent
  - All workload data is encrypted end-to-end
  - Payload size reveals only the tier (1/5/10 GB), not actual workload
"""

from .crypto import (
    generate_ephemeral_keypair,
    EphemeralKeyPair,
    TeeQuote,
    compute_shared_secret,
    derive_aes_key,
    select_padding_tier,
    pad_payload,
    unpad_payload,
    encrypt_payload,
    decrypt_payload,
    verify_encrypted_size,
    encrypt_file,
    decrypt_file,
    encrypt_workspace,
    verify_tee_quote,
)

from .pack import pack_workspace, check_requirements, load_ignore_patterns

__version__ = "0.2.0"
__all__ = [
    "generate_ephemeral_keypair",
    "EphemeralKeyPair",
    "TeeQuote",
    "compute_shared_secret",
    "derive_aes_key",
    "select_padding_tier",
    "pad_payload",
    "unpad_payload",
    "encrypt_payload",
    "decrypt_payload",
    "encrypt_file",
    "decrypt_file",
    "encrypt_workspace",
    "verify_encrypted_size",
    "verify_tee_quote",
    "pack_workspace",
    "check_requirements",
    "load_ignore_patterns",
]
