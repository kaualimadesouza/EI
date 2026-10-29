from topa_api.adapters.security.password_hasher import ScryptPasswordHasher


def test_hashes_password_and_verifies_correct_plain_text() -> None:
    hasher = ScryptPasswordHasher()
    hashed = hasher.hash_password("topa123")

    assert hashed.startswith("scrypt$")
    assert hasher.verify_password("topa123", hashed) is True
    assert hasher.verify_password("wrong_password", hashed) is False


def test_rejects_malformed_hash_format() -> None:
    hasher = ScryptPasswordHasher()

    assert hasher.verify_password("topa123", "not_a_valid_hash") is False
    assert hasher.verify_password("topa123", "scrypt$invalid$format") is False
    assert hasher.verify_password("topa123", "scrypt$not_int$8$1$salt$key") is False
    # n=3 is not a power of 2, triggers ValueError inside hashlib.scrypt
    assert hasher.verify_password("topa123", "scrypt$3$8$1$c2FsdA==$a2V5") is False
