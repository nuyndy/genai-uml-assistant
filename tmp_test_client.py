import sys, os
sys.path.append(r'D:/KHÓA LUẬN/genai-uml-assistant/backend')
from fastapi.testclient import TestClient
from backend.main import app
from backend.tests.conftest import client as fixture_client
# Not using fixture, just create client
client = TestClient(app)
print('client created')
