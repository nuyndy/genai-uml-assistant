"""Test cho get_current_user qua endpoint GET /api/auth/me.
Day la lop bao ve API: yeu cau header 'Authorization: Bearer <token>'.
"""
import time

import pytest
from fastapi import HTTPException

from database.models import User
from routers import auth


def _create_user(db_session, **kwargs) -> User:
    defaults = {
        "email": "user@example.com",
        "name": "Test User",
        "avatar_url": None,
        "google_id": "g-1",
    }
    defaults.update(kwargs)
    user = User(**defaults)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestMeThanhCong:
    def test_token_hop_le_tra_ve_thong_tin_user(self, client, db_session):
        user = _create_user(db_session)
        token = auth._sign({"uid": user.id, "exp": time.time() + 60})

        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 200
        body = res.json()
        assert body["id"] == user.id
        assert body["email"] == "user@example.com"
        assert body["name"] == "Test User"

    def test_khong_lo_google_id_ra_response(self, client, db_session):
        """UserSchema chi co id/email/name/avatar_url."""
        user = _create_user(db_session, google_id="google-bi-mat")
        token = auth._sign({"uid": user.id, "exp": time.time() + 60})

        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 200
        assert "google_id" not in res.json()
        assert set(res.json().keys()) == {"id", "email", "name", "avatar_url"}

    def test_chu_bearer_viet_thuong_van_chap_nhan(self, client, db_session):
        user = _create_user(db_session)
        token = auth._sign({"uid": user.id, "exp": time.time() + 60})

        res = client.get("/api/auth/me", headers={"Authorization": f"bearer {token}"})

        assert res.status_code == 200

    def test_khoang_trang_thua_quanh_token_van_chap_nhan(self, client, db_session):
        user = _create_user(db_session)
        token = auth._sign({"uid": user.id, "exp": time.time() + 60})

        res = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer   {token}  "}
        )

        assert res.status_code == 200


class TestMeThatBai:
    def test_thieu_header_authorization_tra_401(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401
        assert res.json()["detail"] == "Chưa đăng nhập."

    def test_header_rong_tra_401(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": ""})
        assert res.status_code == 401
        assert res.json()["detail"] == "Chưa đăng nhập."

    @pytest.mark.parametrize(
        "bad_header",
        [
            "Basic abc",
            "Token abc",
            "Bearer",
            "Bearertoken",
        ],
    )
    def test_sai_scheme_tra_401(self, client, bad_header):
        res = client.get("/api/auth/me", headers={"Authorization": bad_header})
        assert res.status_code == 401
        assert res.json()["detail"] == "Chưa đăng nhập."

    def test_token_sai_chu_ky_tra_401(self, client, db_session):
        _create_user(db_session)
        res = client.get(
            "/api/auth/me", headers={"Authorization": "Bearer abc.def"}
        )
        assert res.status_code == 401
        assert (
            res.json()["detail"]
            == "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
        )

    def test_token_het_han_tra_401(self, client, db_session):
        user = _create_user(db_session)
        token = auth._sign({"uid": user.id, "exp": time.time() - 10})

        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 401
        assert (
            res.json()["detail"]
            == "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
        )

    def test_token_hop_le_nhung_user_khong_ton_tai_tra_401(self, client):
        token = auth._sign({"uid": 99999, "exp": time.time() + 60})

        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 401
        assert res.json()["detail"] == "Người dùng không tồn tại."

    def test_token_thieu_uid_tra_401(self, client):
        token = auth._sign({"exp": time.time() + 60})

        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert res.status_code == 401
        assert res.json()["detail"] == "Người dùng không tồn tại."

    def test_401_kem_header_www_authenticate(self, client):
        res = client.get("/api/auth/me")
        assert res.headers.get("www-authenticate") == "Bearer"


class TestGetCurrentUserTrucTiep:
    """Goi ham truc tiep (khong qua HTTP) de kiem tra tung nhanh."""

    def test_thieu_authorization_nem_401(self, db_session):
        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(authorization=None, db=db_session)
        assert exc.value.status_code == 401
        assert exc.value.detail == "Chưa đăng nhập."

    def test_token_hop_le_tra_ve_doi_tuong_user(self, db_session):
        user = _create_user(db_session)
        token = auth._sign({"uid": user.id, "exp": time.time() + 60})

        result = auth.get_current_user(
            authorization=f"Bearer {token}", db=db_session
        )

        assert isinstance(result, User)
        assert result.id == user.id

    def test_uid_khong_ton_tai_nem_401(self, db_session):
        _create_user(db_session)
        token = auth._sign({"uid": 123456, "exp": time.time() + 60})

        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(authorization=f"Bearer {token}", db=db_session)

        assert exc.value.status_code == 401
        assert exc.value.detail == "Người dùng không tồn tại."

    def test_uid_kieu_chuoi_van_tim_duoc_user(self, db_session):
        # SQLite/Postgres tu ep kieu '1' khi so sanh voi cot id INT, nen token
        # co uid dang chuoi van hoat dong (chi la luu y, khong phai lo hong).
        user = _create_user(db_session)
        token = auth._sign({"uid": str(user.id), "exp": time.time() + 60})

        result = auth.get_current_user(
            authorization=f"Bearer {token}", db=db_session
        )

        assert result.id == user.id

    def test_uid_chuoi_khong_phai_so_nem_401(self, db_session):
        _create_user(db_session)
        token = auth._sign({"uid": "khong-phai-so", "exp": time.time() + 60})

        with pytest.raises(HTTPException) as exc:
            auth.get_current_user(authorization=f"Bearer {token}", db=db_session)

        assert exc.value.status_code == 401
