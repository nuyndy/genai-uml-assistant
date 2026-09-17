"""Test cho POST /api/auth/google: tao/cap nhat user + tra session token."""
import json
import time
from unittest.mock import patch

import pytest

from database.models import User
from routers import auth


def _fake_urlopen(info: dict):
    """Mock urllib.request.urlopen tra ve payload Google gia lap."""

    class FakeResponse:
        def __init__(self, body: bytes):
            self._body = body

        def read(self):
            return self._body

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    body = json.dumps(info).encode()

    def fake(*args, **kwargs):
        return FakeResponse(body)

    return fake


def _google_info(**kwargs) -> dict:
    base = {
        "email": "newuser@example.com",
        "name": "New User",
        "picture": "https://img/new.png",
        "sub": "google-sub-1",
        "aud": auth.GOOGLE_CLIENT_ID,
    }
    base.update(kwargs)
    return base


class TestGoogleLoginTaoUserMoi:
    def test_tao_user_moi_va_tra_token(self, client, db_session):
        with patch("urllib.request.urlopen", _fake_urlopen(_google_info())):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.status_code == 200
        body = res.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["email"] == "newuser@example.com"
        assert body["user"]["name"] == "New User"
        assert body["user"]["avatar_url"] == "https://img/new.png"

        # User thuc su duoc ghi vao DB
        db_user = db_session.query(User).filter_by(email="newuser@example.com").first()
        assert db_user is not None
        assert db_user.google_id == "google-sub-1"

    def test_token_tra_ve_dung_uid_va_email(self, client, db_session):
        with patch("urllib.request.urlopen", _fake_urlopen(_google_info())):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        token = res.json()["access_token"]
        payload = auth._verify_token(token)

        assert payload is not None
        assert payload["email"] == "newuser@example.com"
        assert payload["uid"] == res.json()["user"]["id"]
        # TTL 7 ngay
        assert payload["exp"] > time.time() + 60 * 60 * 24 * 6

    def test_token_ky_ra_dung_dung_duoc_voi_me(self, client, db_session):
        """Token do login cap phai dung duoc cho /me (tich hop 2 endpoint)."""
        with patch("urllib.request.urlopen", _fake_urlopen(_google_info())):
            login_res = client.post("/api/auth/google", json={"credential": "cred"})
        token = login_res.json()["access_token"]

        me_res = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        )

        assert me_res.status_code == 200
        assert me_res.json()["email"] == "newuser@example.com"
        assert me_res.json()["id"] == login_res.json()["user"]["id"]

    def test_khong_tra_ve_google_id_cho_frontend(self, client, db_session):
        with patch("urllib.request.urlopen", _fake_urlopen(_google_info())):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert "google_id" not in res.json()["user"]

    def test_google_tra_thieu_name_va_picture(self, client, db_session):
        info = _google_info()
        info.pop("name")
        info.pop("picture")

        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.status_code == 200
        assert res.json()["user"]["name"] is None
        assert res.json()["user"]["avatar_url"] is None

    def test_hai_email_khac_nhau_tao_hai_user(self, client, db_session):
        with patch("urllib.request.urlopen", _fake_urlopen(_google_info())):
            client.post("/api/auth/google", json={"credential": "c1"})

        other = _google_info(email="other@example.com", sub="google-sub-2")
        with patch("urllib.request.urlopen", _fake_urlopen(other)):
            client.post("/api/auth/google", json={"credential": "c2"})

        assert db_session.query(User).count() == 2


class TestGoogleLoginCapNhatUserCu:
    def _seed_user(self, db_session):
        user = User(
            email="existing@example.com",
            name="Ten Cu",
            avatar_url="https://img/cu.png",
            google_id="google-cu",
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user
    def test_cap_nhat_thong_tin_ho_so_tu_google(self, client, db_session):
        user = self._seed_user(db_session)
        info = _google_info(
            email="existing@example.com",
            name="Ten Moi",
            picture="https://img/moi.png",
            sub="google-moi",
        )

        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.status_code == 200
        db_session.refresh(user)
        assert user.name == "Ten Moi"
        assert user.avatar_url == "https://img/moi.png"
        assert user.google_id == "google-moi"

    def test_khong_tao_user_trung_email(self, client, db_session):
        self._seed_user(db_session)

        with patch("urllib.request.urlopen", _fake_urlopen(_google_info(email="existing@example.com"))):
            client.post("/api/auth/google", json={"credential": "cred"})

        assert db_session.query(User).filter_by(email="existing@example.com").count() == 1

    def test_google_khong_tra_name_thi_giu_ten_cu(self, client, db_session):
        """Logic `name or user.name` -> gia tri moi falsy thi giu gia tri cu."""
        user = self._seed_user(db_session)
        info = _google_info(email="existing@example.com")
        info.pop("name")
        info.pop("picture")

        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            client.post("/api/auth/google", json={"credential": "cred"})

        db_session.refresh(user)
        assert user.name == "Ten Cu"
        assert user.avatar_url == "https://img/cu.png"

    def test_google_tra_name_rong_thi_giu_ten_cu(self, client, db_session):
        user = self._seed_user(db_session)
        info = _google_info(email="existing@example.com", name="", picture="")

        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            client.post("/api/auth/google", json={"credential": "cred"})

        db_session.refresh(user)
        assert user.name == "Ten Cu"

    def test_google_thieu_sub_thi_giu_google_id_cu(self, client, db_session):
        user = self._seed_user(db_session)
        info = _google_info(email="existing@example.com")
        info.pop("sub")

        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            client.post("/api/auth/google", json={"credential": "cred"})

        db_session.refresh(user)
        assert user.google_id == "google-cu"

    def test_id_user_khong_doi_sau_khi_dang_nhap_lai(self, client, db_session):
        user = self._seed_user(db_session)
        original_id = user.id

        with patch("urllib.request.urlopen", _fake_urlopen(_google_info(email="existing@example.com"))):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.json()["user"]["id"] == original_id


class TestGoogleLoginThatBai:
    def test_google_token_khong_hop_le_tra_401(self, client):
        def boom(*args, **kwargs):
            raise OSError("khong ket noi duoc Google")

        with patch("urllib.request.urlopen", boom):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.status_code == 401
        assert res.json()["detail"] == "Google token không hợp lệ."

    def test_aud_sai_tra_401_va_khong_tao_user(self, client, db_session):
        info = _google_info(aud="client-id-khac")
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.status_code == 401
        assert res.json()["detail"] == "Google token không thuộc ứng dụng này."
        assert db_session.query(User).count() == 0

    def test_thieu_email_tra_401(self, client, db_session):
        info = _google_info()
        info.pop("email")
        with patch("urllib.request.urlopen", _fake_urlopen(info)):
            res = client.post("/api/auth/google", json={"credential": "cred"})

        assert res.status_code == 401
        assert db_session.query(User).count() == 0

    @pytest.mark.parametrize("bad_body", [{}, {"credential": ""}, {"credential": None}])
    def test_body_thieu_hoac_rong_credential_tra_422(self, client, bad_body):
        res = client.post("/api/auth/google", json=bad_body)
        assert res.status_code == 422

    def test_thieu_credential_hoan_toan_tra_422(self, client):
        res = client.post("/api/auth/google", json={})
        assert res.status_code == 422

    def test_credential_khong_phai_chuoi_tra_422(self, client):
        res = client.post("/api/auth/google", json={"credential": 12345})
        assert res.status_code == 422
