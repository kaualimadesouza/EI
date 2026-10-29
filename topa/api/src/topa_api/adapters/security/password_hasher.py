import base64
import hashlib
import hmac
import secrets


class ScryptPasswordHasher:
    """Hashes and verifies passwords using the scrypt key derivation function."""

    def __init__(self, n: int = 16384, r: int = 8, p: int = 1, dklen: int = 32) -> None:
        self._n = n
        self._r = r
        self._p = p
        self._dklen = dklen

    def hash_password(self, password: str) -> str:
        salt = secrets.token_bytes(16)
        key = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=self._n,
            r=self._r,
            p=self._p,
            maxmem=0,
            dklen=self._dklen,
        )
        b64_salt = base64.b64encode(salt).decode("ascii")
        b64_key = base64.b64encode(key).decode("ascii")
        return f"scrypt${self._n}${self._r}${self._p}${b64_salt}${b64_key}"

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        parts = hashed_password.split("$")
        if len(parts) != 6 or parts[0] != "scrypt":
            return False
        try:
            n = int(parts[1])
            r = int(parts[2])
            p = int(parts[3])
            salt = base64.b64decode(parts[4].encode("ascii"))
            expected_key = base64.b64decode(parts[5].encode("ascii"))
            computed = hashlib.scrypt(
                plain_password.encode("utf-8"),
                salt=salt,
                n=n,
                r=r,
                p=p,
                maxmem=0,
                dklen=len(expected_key),
            )
            return hmac.compare_digest(computed, expected_key)
        except (ValueError, TypeError):
            return False
