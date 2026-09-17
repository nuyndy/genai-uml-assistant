"""Test cho _verify_google_token: xac minh ID token voi Google.
Moi test deu mock urllib.request.urlopen -> khong goi mang that.
"""
import io
import json
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from routers import auth


def _fake_urlopen(payload: dict, *, raw_body: bytes | None = None):
    """Tra ve context manager gia lap urlopen, doc duoc payload JSON."""

    class FakeResponse:
        def __init__(self, body: bytes):
            self._body = body

        def read(self):
            return self._body

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    body = raw_body if raw_body is not None else json.dumps(payload).encode()

    def fake(*args, **kwargs):
        return FakeResponse(body)

    return fake


class TestVerifyGoogleTokenThanhCong:
    def test_token_hop_le_tra_ve_payload_day_du(self):
        info = {
            "email": "user@example.com",
            "name": "Nguyen Van A",
            "picture": "https://img/a.png",
            "sub": "google-uid-123",
            "aud": auth.GOOGLE_CLIENT_ID,
        }
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            result = auth._verify_google_token("credential-gia")

        assert result["email"] == "user@example.com"
        assert result["sub"] == "google-uid-123"
        assert result["name"] == "Nguyen Van A"

    def test_thieu_name_va_picture_van_hop_le(self):
        """Chi can email; name/picture la tuy chon."""
        info = {"email": "a@b.c", "sub": "s1", "aud": auth.GOOGLE_CLIENT_ID}
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            result = auth._verify_google_token("cred")

        assert result["email"] == "a@b.c"
        assert result.get("name") is None

    def test_goi_dung_url_tokeninfo_voi_id_token(self):
        info = {"email": "a@b.c", "aud": auth.GOOGLE_CLIENT_ID}
        captured = {}

        def spy(url, **kwargs):
            captured["url"] = url
            return _fake_urlopen(info)()

        with patch("urllib.request.urlopen", spy):
            auth._verify_google_token("my-credential")

        assert captured["url"].startswith(
            "https://oauth2.googleapis.com/tokeninfo?"
        )
        assert "id_token=my-credential" in captured["url"]


class TestVerifyGoogleTokenThatBai:
    def test_urlopen_nem_loi_tra_401(self):
        def boom(*args, **kwargs):
            raise OSError("khong ket noi duoc Google")

        with patch("urllib.request.urlopen", boom):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Google token không hợp lệ."

    def test_timeout_cung_tra_401(self):
        import socket

        def boom(*args, **kwargs):
            raise socket.timeout("het thoi gian cho")

        with patch("urllib.request.urlopen", boom):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.status_code == 401

    def test_body_khong_phai_json_tra_401(self):
        with patch(
            "urllib.request.urlopen",
            _fake_urlopen({}, raw_body=b"<html>loi Google</html>"),
        ):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Google token không hợp lệ."

    def test_aud_khong_khop_tra_401(self):
        info = {"email": "a@b.c", "aud": "client-id-cua-ung-dung-khac"}
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Google token không thuộc ứng dụng này."

    def test_thieu_email_tra_401(self):
        info = {"sub": "s1", "aud": auth.GOOGLE_CLIENT_ID}
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Google token thiếu thông tin email."

    def test_email_rong_cung_tra_401(self):
        info = {"email": "", "aud": auth.GOOGLE_CLIENT_ID}
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.status_code == 401
        assert exc.value.detail == "Google token thiếu thông tin email."

    def test_aud_khong_khop_duoc_uu_tien_bao_truoc_thieu_email(self):
        """Khi ca hai deu sai, loi aud duoc bao truoc (thu tu kiem tra)."""
        info = {"aud": "sai-client-id"}
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            with pytest.raises(HTTPException) as exc:
                auth._verify_google_token("cred")

        assert exc.value.detail == "Google token không thuộc ứng dụng này."


class TestVerifyGoogleTokenKhiChuaCauHinhClientId:
    def test_bo_qua_kiem_tra_aud_khi_client_id_rong(self, monkeypatch):
        """GOOGLE_CLIENT_ID rong -> khong kiem tra audience (che do dev)."""
        monkeypatch.setattr(auth, "GOOGLE_CLIENT_ID", "")
        info = {"email": "a@b.c", "aud": "bat-ky"}
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            result = auth._verify_google_token("cred")

        assert result["email"] == "a@b.c"
