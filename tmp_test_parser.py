import sys, os, json
sys.path.append(r'D:/KHÓA LUẬN/genai-uml-assistant')
from backend.services.plantuml_parser import parse_plantuml
sample = """@startuml
actor "User" as U
usecase "Login" as LC
class "Account" as A {\n  +id: int\n  +email: str\n  login()\n}\nU --> LC\nA --> LC\n@enduml"""
print(json.dumps(parse_plantuml(sample), ensure_ascii=False, indent=2))
