from services.plantuml_parser import parse_plantuml
import json
source = """
@startuml
class Animal
class Dog
class Owner
class Car
class Engine
Dog --|> Animal : kế thừa
Owner --> Car : sử dụng
Car *-- Engine : chứa
Owner o-- Car : sở hữu
@enduml
"""
print(json.dumps(parse_plantuml(source), ensure_ascii=False, indent=2))