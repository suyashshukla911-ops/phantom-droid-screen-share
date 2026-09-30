import hashlib
import hmac
import secrets
import unittest

def digest(value): return hashlib.sha256(value.encode()).hexdigest()

class TokenTests(unittest.TestCase):
    def test_random_values_are_distinct(self):
        a = secrets.token_urlsafe(32)
        b = secrets.token_urlsafe(32)
        self.assertNotEqual(a, b)

    def test_digest_is_not_plaintext(self):
        value = secrets.token_urlsafe(32)
        self.assertNotEqual(digest(value), value)
        self.assertEqual(len(digest(value)), 64)

    def test_constant_time_compare(self):
        a = digest("secret")
        b = digest("secret")
        self.assertTrue(hmac.compare_digest(a, b))

if __name__ == "__main__":
    unittest.main()
