CREATE TABLE conversations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    visitor_token VARCHAR(64) NOT NULL,
    visitor_name VARCHAR(100),
    visitor_email VARCHAR(255),
    status ENUM('WAITING', 'ACTIVE', 'RESOLVED', 'CLOSED') DEFAULT 'WAITING',
    agent_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_visitor_token (visitor_token),
    INDEX idx_agent_id (agent_id),
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
