from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database.db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    
    projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "project"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="projects")


class RawRequirement(Base):
    __tablename__ = "raw_requirement"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String, default="draft")


class UserStory(Base):
    __tablename__ = "user_story"
    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("raw_requirement.id"), nullable=False)
    role = Column(String)
    feature = Column(Text, nullable=False)
    benefit = Column(Text)
    acceptance_criteria = Column(Text)


class Specification(Base):
    __tablename__ = "specification"
    id = Column(Integer, primary_key=True, index=True)
    user_story_id = Column(Integer, ForeignKey("user_story.id"), nullable=False)
    type = Column(String)
    content = Column(Text, nullable=False)
    version = Column(Integer, default=1)


class UseCase(Base):
    __tablename__ = "use_case"
    id = Column(Integer, primary_key=True, index=True)
    specification_id = Column(Integer, ForeignKey("specification.id"), nullable=False)
    name = Column(String, nullable=False)
    main_flow = Column(Text)
    alt_flow = Column(Text)
    exception_flow = Column(Text)


class Actor(Base):
    __tablename__ = "actor"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    name = Column(String, nullable=False)


class UcActorRelation(Base):
    __tablename__ = "uc_actor_relation"
    id = Column(Integer, primary_key=True, index=True)
    use_case_id = Column(Integer, ForeignKey("use_case.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("actor.id"), nullable=False)
    relation_type = Column(String)


class ClassEntity(Base):
    __tablename__ = "class_entity"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    name = Column(String, nullable=False)
    attributes = Column(Text)
    methods = Column(Text)


class ClassRelation(Base):
    __tablename__ = "class_relation"
    id = Column(Integer, primary_key=True, index=True)
    class_a_id = Column(Integer, ForeignKey("class_entity.id"), nullable=False)
    class_b_id = Column(Integer, ForeignKey("class_entity.id"), nullable=False)
    relation_type = Column(String)


class Diagram(Base):
    __tablename__ = "diagram"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    use_case_id = Column(Integer, ForeignKey("use_case.id"), nullable=True)
    type = Column(String)
    source_code = Column(Text, nullable=False)
    image_url = Column(String)
    version = Column(Integer, default=1)