-- 1. Bảng Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Bảng Project
CREATE TABLE project (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_project_owner FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- 3. Bảng Thành viên Dự án (Project Member)
CREATE TABLE project_member (
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(50) DEFAULT 'editor',
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Bảng Raw Requirement
CREATE TABLE raw_requirement (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_req_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- 5. Bảng User Story
CREATE TABLE user_story (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL,
  role VARCHAR(255),
  feature TEXT NOT NULL,
  benefit TEXT,
  acceptance_criteria TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_story_req FOREIGN KEY (requirement_id) REFERENCES raw_requirement(id) ON DELETE CASCADE
);

-- 6. Bảng Specification
CREATE TABLE specification (
  id SERIAL PRIMARY KEY,
  user_story_id INTEGER NOT NULL,
  type VARCHAR(50),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_spec_story FOREIGN KEY (user_story_id) REFERENCES user_story(id) ON DELETE CASCADE
);

-- 7. Bảng Use Case
CREATE TABLE use_case (
  id SERIAL PRIMARY KEY,
  specification_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  main_flow TEXT,
  alt_flow TEXT,
  exception_flow TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_uc_spec FOREIGN KEY (specification_id) REFERENCES specification(id) ON DELETE CASCADE
);

-- 8. Bảng Actor
CREATE TABLE actor (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  CONSTRAINT fk_actor_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- 9. Quan hệ Actor - Use Case
CREATE TABLE uc_actor_relation (
  id SERIAL PRIMARY KEY,
  use_case_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  relation_type VARCHAR(50) DEFAULT 'association',
  CONSTRAINT fk_uar_uc FOREIGN KEY (use_case_id) REFERENCES use_case(id) ON DELETE CASCADE,
  CONSTRAINT fk_uar_actor FOREIGN KEY (actor_id) REFERENCES actor(id) ON DELETE CASCADE,
  CONSTRAINT uq_uc_actor UNIQUE (use_case_id, actor_id, relation_type)
);

-- 10. Quan hệ Use Case - Use Case (Include / Extend)
CREATE TABLE uc_uc_relation (
  id SERIAL PRIMARY KEY,
  source_uc_id INTEGER NOT NULL,
  target_uc_id INTEGER NOT NULL,
  relation_type VARCHAR(50) NOT NULL,
  CONSTRAINT fk_uur_source FOREIGN KEY (source_uc_id) REFERENCES use_case(id) ON DELETE CASCADE,
  CONSTRAINT fk_uur_target FOREIGN KEY (target_uc_id) REFERENCES use_case(id) ON DELETE CASCADE,
  CONSTRAINT uq_uc_uc UNIQUE (source_uc_id, target_uc_id, relation_type)
);

-- 11. Bảng Class Entity
CREATE TABLE class_entity (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  attributes JSONB,
  methods JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_class_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- 12. Bảng Quan hệ giữa các Class
CREATE TABLE class_relation (
  id SERIAL PRIMARY KEY,
  class_a_id INTEGER NOT NULL,
  class_b_id INTEGER NOT NULL,
  relation_type VARCHAR(50),
  multiplicity_a VARCHAR(20),
  multiplicity_b VARCHAR(20),
  CONSTRAINT fk_cr_a FOREIGN KEY (class_a_id) REFERENCES class_entity(id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_b FOREIGN KEY (class_b_id) REFERENCES class_entity(id) ON DELETE CASCADE
);

-- 13. Bảng Diagram
CREATE TABLE diagram (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  use_case_id INTEGER,
  type VARCHAR(50),
  source_code TEXT NOT NULL,
  image_url VARCHAR(255),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_diagram_project FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE,
  CONSTRAINT fk_diagram_uc FOREIGN KEY (use_case_id) REFERENCES use_case(id) ON DELETE SET NULL
);

-- 14. Bảng Lịch sử Diagram (Audit Trail)
CREATE TABLE diagram_history (
  id SERIAL PRIMARY KEY,
  diagram_id INTEGER NOT NULL,
  source_code TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_dh_diagram FOREIGN KEY (diagram_id) REFERENCES diagram(id) ON DELETE CASCADE
);