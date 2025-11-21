-- Create tables
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    score INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    parent_id BIGINT,
    level INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE folders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    parent_id BIGINT,
    path VARCHAR(1000) NOT NULL,
    depth INTEGER DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY uk_folder_parent_name (parent_id, name)
);

CREATE TABLE documents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum VARCHAR(128),
    folder_id BIGINT,
    folder_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'UPLOADED',
    category_id BIGINT,
    uploaded_by BIGINT NOT NULL,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE document_types (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(1000),
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE form_configs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    category_id BIGINT,
    prompt_template TEXT,
    model_config VARCHAR(2000),
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE document_type_form_configs (
    document_type_id BIGINT NOT NULL,
    form_config_id BIGINT NOT NULL,
    PRIMARY KEY (document_type_id, form_config_id),
    FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE CASCADE,
    FOREIGN KEY (form_config_id) REFERENCES form_configs(id) ON DELETE CASCADE
);

CREATE TABLE form_fields (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    form_config_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    label VARCHAR(200) NOT NULL,
    placeholder VARCHAR(500),
    required BOOLEAN DEFAULT FALSE,
    validation_rules VARCHAR(1000),
    options VARCHAR(2000),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_config_id) REFERENCES form_configs(id) ON DELETE CASCADE
);

CREATE TABLE recognition_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    form_config_id BIGINT NOT NULL,
    raw_result VARCHAR(5000),
    processed_result VARCHAR(5000),
    confidence_score DECIMAL(3,2),
    model_name VARCHAR(100),
    processing_time INTEGER,
    status VARCHAR(20) DEFAULT 'SUCCESS',
    error_message VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (form_config_id) REFERENCES form_configs(id)
);

CREATE TABLE tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000),
    document_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    form_config_id BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'CREATED',
    priority VARCHAR(10) DEFAULT 'NORMAL',
    deadline TIMESTAMP,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (form_config_id) REFERENCES form_configs(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE task_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    assignment_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    notes VARCHAR(1000),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE annotations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    task_assignment_id BIGINT NOT NULL,
    annotation_data VARCHAR(5000) NOT NULL,
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'DRAFT',
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    reviewer_id BIGINT,
    review_notes VARCHAR(1000),
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (task_assignment_id) REFERENCES task_assignments(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

CREATE TABLE quality_checks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    annotator_a_id BIGINT NOT NULL,
    annotator_b_id BIGINT NOT NULL,
    annotation_a_id BIGINT,
    annotation_b_id BIGINT,
    comparison_result VARCHAR(20),
    conflict_fields VARCHAR(2000),
    resolved_by BIGINT,
    resolution_notes VARCHAR(1000),
    resolved_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (annotator_a_id) REFERENCES users(id),
    FOREIGN KEY (annotator_b_id) REFERENCES users(id),
    FOREIGN KEY (annotation_a_id) REFERENCES annotations(id),
    FOREIGN KEY (annotation_b_id) REFERENCES annotations(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE TABLE score_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    score_change INTEGER NOT NULL,
    previous_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    score_type VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    task_id BIGINT,
    annotation_id BIGINT,
    quality_check_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (annotation_id) REFERENCES annotations(id),
    FOREIGN KEY (quality_check_id) REFERENCES quality_checks(id)
);

CREATE TABLE user_scores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    total_score INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    accuracy_rate DECIMAL(5,4) DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE score_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    task_id BIGINT,
    score_change INTEGER NOT NULL,
    score_type VARCHAR(50) NOT NULL,
    reason VARCHAR(1000),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Create indexes
CREATE INDEX idx_document_types_name ON document_types(name);
CREATE INDEX idx_document_types_is_active ON document_types(is_active);
CREATE INDEX idx_document_type_form_configs_doc_type ON document_type_form_configs(document_type_id);
CREATE INDEX idx_document_type_form_configs_form_config ON document_type_form_configs(form_config_id);
CREATE INDEX idx_form_configs_category_id ON form_configs(category_id);
CREATE INDEX idx_documents_category_id ON documents(category_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_tasks_document_id ON tasks(document_id);
CREATE INDEX idx_tasks_category_id ON tasks(category_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_user_id ON task_assignments(user_id);
CREATE INDEX idx_annotations_task_id ON annotations(task_id);
CREATE INDEX idx_annotations_status ON annotations(status);
CREATE INDEX idx_quality_checks_task_id ON quality_checks(task_id);
CREATE INDEX idx_quality_checks_status ON quality_checks(status);
-- 性能优化索引
CREATE INDEX idx_score_history_user_id ON score_history(user_id);
CREATE INDEX idx_score_history_score_type ON score_history(score_type);
CREATE INDEX idx_score_history_created_at ON score_history(created_at);
CREATE INDEX idx_score_history_user_created ON score_history(user_id, created_at);
CREATE INDEX idx_score_history_type_created ON score_history(score_type, created_at);

-- 用户表索引优化
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 任务表索引优化
CREATE INDEX idx_tasks_status_priority ON tasks(status, priority);
CREATE INDEX idx_tasks_category_status ON tasks(category_id, status);
CREATE INDEX idx_tasks_created_by_status ON tasks(created_by, status);

-- 任务分配表索引优化
CREATE INDEX idx_task_assignments_user_status ON task_assignments(user_id, status);
CREATE INDEX idx_task_assignments_task_status ON task_assignments(task_id, status);

-- 标注表索引优化
CREATE INDEX idx_annotations_user_status ON annotations(task_assignment_id, status);

-- 质量检查表索引优化
CREATE INDEX idx_quality_checks_status_created ON quality_checks(status, created_at);

-- Insert data in correct order
INSERT INTO users (username, email, password, role, score, status) VALUES
('admin', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 100, 'ACTIVE'),
('annotator', 'annotator@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ANNOTATOR', 80, 'ACTIVE'),
('reviewer', 'reviewer@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'REVIEWER', 90, 'ACTIVE'),
('expert', 'expert@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'EXPERT', 95, 'ACTIVE');

INSERT INTO categories (name, description, level, sort_order, created_by) VALUES
('财务文档', '财务相关文档分类', 1, 1, 1),
('合同文档', '合同相关文档分类', 1, 2, 1),
('人事文档', '人事相关文档分类', 1, 3, 1),
('技术文档', '技术相关文档分类', 1, 4, 1);

INSERT INTO form_configs (name, description, category_id, prompt_template, is_active, created_by) VALUES
('财务报表识别', '识别财务报表中的关键字段', 1, '请识别以下财务报表中的关键信息：公司名称、报表期、总资产、总负债、净利润等', true, 1),
('合同信息提取', '提取合同中的关键条款信息', 2, '请提取合同中的：合同编号、甲方、乙方、签订日期、合同金额、主要条款等信息', true, 1),
('人事档案识别', '识别人事档案中的基本信息', 3, '请识别人事档案中的：姓名、性别、出生日期、职位、入职时间、薪资等信息', true, 1),
('技术文档识别', '识别技术文档中的元数据', 4, '请识别技术文档中的：文档标题、版本号、作者、创建日期、技术领域等信息', true, 1);

INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(1, 'company_name', 'TEXT', '公司名称', true, 1);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(1, 'report_period', 'TEXT', '报表期间', true, 2);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(1, 'total_assets', 'NUMBER', '总资产', false, 3);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(1, 'total_liabilities', 'NUMBER', '总负债', false, 4);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(1, 'net_profit', 'NUMBER', '净利润', false, 5);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(2, 'contract_number', 'TEXT', '合同编号', true, 1);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(2, 'party_a', 'TEXT', '甲方', true, 2);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(2, 'party_b', 'TEXT', '乙方', true, 3);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(2, 'signing_date', 'DATE', '签订日期', true, 4);
INSERT INTO form_fields (form_config_id, field_name, field_type, label, required, sort_order) VALUES
(2, 'contract_amount', 'NUMBER', '合同金额', false, 5);
