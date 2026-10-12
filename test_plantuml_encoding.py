from services.plantuml_parser import parse_plantuml
import json
source = """
@startuml
actor "Người dùng" as User
usecase "Đăng nhập" as Login
class "TaiKhoan" as Account {
  +id: int
  +login()
}
User --> Login : thực hiện
Account --> Login : xử lý
@enduml
"""
print(json.dumps(parse_plantuml(source), ensure_ascii=False, indent=2))