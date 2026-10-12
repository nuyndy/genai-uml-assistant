from dotenv import load_dotenv
load_dotenv("backend/.env")
from services.plantuml_parser import parse_plantuml
source = """@startuml
class Animal
class Dog
Dog --|> Animal : kế thừa
@enduml"""
print(parse_plantuml(source))