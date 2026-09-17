"""Test cho session token: _sign / _verify_token.
Token la chuoi tu ky dang base64url(payload).hmac_sha256_hex.
"""
import base64
import json
import time

import pytest

from routers import auth


def _make_raw(payload: dict) -> str:
    """Tao phan payload base64url y nhu _sign, de gia mao chu ky."""
    return base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()


class TestSign:
    def test_tra_ve_chuoi_co_dung_dinh_dang_hai_phan(self):
        token = auth._sign({"uid": 1, "exp": time.time() + 60})
        assert isinstance(token, str)
        assert token.count(".") == 1
        raw, sig = token.split(".")
        assert raw and sig

    def test_payload_co_the_giai_ma_lai_duoc(self):
        payload = {"uid": 42, "email": "a@b.c", "exp": time.time() + 60}
        raw, _ = auth._sign(payload).split(".")
        decoded = json.loads(base64.urlsafe_b64decode(raw.encode()))
        assert decoded == payload

    def test_cung_payload_cho_ra_cung_token(self):
        payload = {"uid": 7, "exp": 1234567890}
        assert auth._sign(payload) == auth._sign(payload)

    def test_payload_khac_nhau_cho_ra_token_khac_nhau(self):
        assert auth._sign({"uid": 1}) != auth._sign({"uid": 2})

    def test_chu_ky_dung_hmac_sha256_tren_phan_raw(self):
        import hashlib
        import hmac

        payload = {"uid": 5, "exp": time.time() + 60}
        raw, sig = auth._sign(payload).split(".")
        expected = hmac.new(
            auth.SECRET_KEY.encode(), raw.encode(), hashlib.sha256
        ).hexdigest()
        assert sig == expected


class TestVerifyToken:
    def test_token_hop_le_tra_ve_payload(self):
        payload = {"uid": 9, "email": "x@y.z", "exp": time.time() + 60}
        token = auth._sign(payload)
        assert auth._verify_token(token) == payload

    def test_token_het_han_tra_ve_none(self):
        token = auth._sign({"uid": 1, "exp": time.time() - 1})
        assert auth._verify_token(token) is None

    def test_exp_dung_bang_now_duoc_coi_la_het_han(self):
        # code dung `exp < time.time()` -> exp == now se bi tinh la het han
        now = time.time()
        token = auth._sign({"uid": 1, "exp": now})
        # cho thoi gian troi qua mot chut de chac chan now < time.time()
        time.sleep(0.01)
        assert auth._verify_token(token) is None

    def test_thieu_truong_exp_tra_ve_none(self):
        # `.get("exp", 0)` -> 0 < now -> het han
        token = auth._sign({"uid": 1})
        assert auth._verify_token(token) is None

    def test_sai_chu_ky_tra_ve_none(self):
        raw = _make_raw({"uid": 1, "exp": time.time() + 60})
        token = f"{raw}.{'0' * 64}"
        assert auth._verify_token(token) is None

    def test_sua_payload_lam_sai_chu_ky(self):
        """Tan cong: doi uid trong payload nhung giu nguyen chu ky."""
        token = auth._sign({"uid": 1, "exp": time.time() + 60})
        raw, sig = token.split(".")
        tampered_raw = _make_raw({"uid": 999, "exp": time.time() + 60})
        assert auth._verify_token(f"{tampered_raw}.{sig}") is None

    def test_chu_ky_cua_secret_khac_tra_ve_none(self):
        import hashlib
        import hmac

        raw = _make_raw({"uid": 1, "exp": time.time() + 60})
        sig = hmac.new(b"secret-khac", raw.encode(), hashlib.sha256).hexdigest()
        assert auth._verify_token(f"{raw}.{sig}") is None

    @pytest.mark.parametrize(
        "bad_token",
        [
            "",
            "khong-co-dau-cham",
            ".",
            "abc.",
            ".abc",
            "!!!.###",
            "a.b.c",
        ],
    )
    def test_token_meo_tra_ve_none_khong_nem_loi(self, bad_token):
        assert auth._verify_token(bad_token) is None

    def test_base64_khong_hop_le_tra_ve_none(self):
        # chu ky dung nhung payload khong phai base64/json hop le
        import hashlib
        import hmac

        raw = "khong-phai-base64-hop-le"
        sig = hmac.new(
            auth.SECRET_KEY.encode(), raw.encode(), hashlib.sha256
        ).hexdigest()
        assert auth._verify_token(f"{raw}.{sig}") is None
